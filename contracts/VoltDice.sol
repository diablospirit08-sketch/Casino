// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IBankroll} from "./VoltBankroll.sol";

/// @title VoltDice — roll-under dice for the VOLT casino
/// @notice Classic dice: pick a number T in [1, 98], roll 0-99, you win if the
///         roll lands strictly under T. Win chance is T%, payout is 99/T of
///         the wager (a 1% house edge). All money flows through the
///         VoltBankroll vault, which caps and escrows every payout.
///
/// Randomness is commit-reveal:
///   1. The house pre-commits hashes of secret seeds (commitSeeds). Seeds are
///      committed before any bet exists, so they cannot be chosen against a
///      specific wager.
///   2. A bet consumes one unused seed hash and mixes in the bet id, the
///      player address, and a player-supplied client seed — so neither side
///      alone controls the roll: the player doesn't know the seed, and the
///      house fixed it before knowing the bet.
///   3. The house reveals the seed to resolve the bet. If it stalls past
///      REVEAL_TIMEOUT — e.g. to bury a losing roll — the player may claim
///      the FULL potential payout, making non-reveal strictly worse for the
///      house than revealing any outcome. This closes the classic
///      commit-reveal loophole of refunding only the wager.
///
/// Known limitation: the house knows its own seeds, so it could place winning
/// bets against itself. That only moves house money to the house — it matters
/// once third parties stake the bankroll, at which point switch to an oracle
/// such as Chainlink VRF.
contract VoltDice {
    uint256 public constant REVEAL_TIMEOUT = 1 hours;
    uint8 public constant MIN_ROLL_UNDER = 1; // 1% win chance, pays 99x
    uint8 public constant MAX_ROLL_UNDER = 98; // 98% win chance, pays ~1.01x

    enum SeedState {
        None,
        Committed,
        Used
    }

    struct Bet {
        address player;
        uint64 placedAt;
        uint8 rollUnder;
        bool settled;
        uint256 wager;
        uint256 potentialPayout;
        bytes32 seedHash;
        uint256 clientSeed;
    }

    IBankroll public immutable bankroll;
    address public owner;
    uint256 public minWager = 0.001 ether;

    mapping(bytes32 => SeedState) public seedHashes;
    mapping(uint256 => Bet) public bets;
    uint256 public nextBetId;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SeedsCommitted(uint256 count);
    event MinWagerSet(uint256 minWager);
    event BetPlaced(
        uint256 indexed betId,
        address indexed player,
        uint256 wager,
        uint8 rollUnder,
        bytes32 seedHash,
        uint256 clientSeed
    );
    event BetResolved(uint256 indexed betId, address indexed player, uint8 roll, uint256 payout);
    event BetTimedOut(uint256 indexed betId, address indexed player, uint256 payout);

    error NotOwner();
    error WagerTooSmall();
    error RollUnderOutOfRange();
    error SeedNotAvailable();
    error SeedAlreadyKnown();
    error UnknownBet();
    error AlreadySettled();
    error WrongSeed();
    error NotPlayer();
    error RevealNotOverdue();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IBankroll bankroll_) {
        bankroll = bankroll_;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ---------------------------------------------------------------- views

    /// @notice Largest wager the bankroll currently accepts for a given
    ///         target, for the betting UI. Derived from the vault's payout cap.
    function maxWager(uint8 rollUnder) external view returns (uint256) {
        return (bankroll.maxPayout() * rollUnder) / 99;
    }

    // ----------------------------------------------------------- player flow

    /// @notice Place a wager. The frontend supplies an unused committed seed
    ///         hash and a client seed of the player's choosing.
    function placeBet(uint8 rollUnder, bytes32 seedHash, uint256 clientSeed)
        external
        payable
        returns (uint256 betId)
    {
        if (msg.value < minWager) revert WagerTooSmall();
        if (rollUnder < MIN_ROLL_UNDER || rollUnder > MAX_ROLL_UNDER) revert RollUnderOutOfRange();
        if (seedHashes[seedHash] != SeedState.Committed) revert SeedNotAvailable();
        seedHashes[seedHash] = SeedState.Used;

        // 99/T multiplier: 1% edge under the fair 100/T. Payout includes the
        // wager, which the bankroll escrowed along with it.
        uint256 potentialPayout = (msg.value * 99) / rollUnder;

        betId = nextBetId++;
        bets[betId] = Bet({
            player: msg.sender,
            placedAt: uint64(block.timestamp),
            rollUnder: rollUnder,
            settled: false,
            wager: msg.value,
            potentialPayout: potentialPayout,
            seedHash: seedHash,
            clientSeed: clientSeed
        });

        // Reverts if potentialPayout exceeds the vault's single-bet cap.
        bankroll.escrowBet{value: msg.value}(potentialPayout);

        emit BetPlaced(betId, msg.sender, msg.value, rollUnder, seedHash, clientSeed);
    }

    /// @notice Resolve a bet by revealing the seed behind its hash. Callable
    ///         by anyone, since only the house knows the preimage.
    function reveal(uint256 betId, bytes32 seed) external {
        Bet storage bet = bets[betId];
        if (bet.player == address(0)) revert UnknownBet();
        if (bet.settled) revert AlreadySettled();
        if (keccak256(abi.encodePacked(seed)) != bet.seedHash) revert WrongSeed();
        bet.settled = true;

        uint8 roll = uint8(
            uint256(keccak256(abi.encodePacked(seed, betId, bet.player, bet.clientSeed))) % 100
        );
        uint256 payout = roll < bet.rollUnder ? bet.potentialPayout : 0;

        bankroll.settle(bet.player, bet.potentialPayout, payout);
        emit BetResolved(betId, bet.player, roll, payout);
    }

    /// @notice If the house hasn't revealed within REVEAL_TIMEOUT, the player
    ///         claims the full potential payout — the non-reveal penalty that
    ///         keeps the house honest about losing rolls.
    function claimTimeout(uint256 betId) external {
        Bet storage bet = bets[betId];
        if (bet.player == address(0)) revert UnknownBet();
        if (msg.sender != bet.player) revert NotPlayer();
        if (bet.settled) revert AlreadySettled();
        if (block.timestamp <= bet.placedAt + REVEAL_TIMEOUT) revert RevealNotOverdue();
        bet.settled = true;

        bankroll.settle(bet.player, bet.potentialPayout, bet.potentialPayout);
        emit BetTimedOut(betId, bet.player, bet.potentialPayout);
    }

    // ------------------------------------------------------------ house ops

    /// @notice Pre-commit a batch of seed hashes (keccak256 of each secret
    ///         seed). The house must keep enough unused hashes available for
    ///         new bets.
    function commitSeeds(bytes32[] calldata hashes) external onlyOwner {
        for (uint256 i = 0; i < hashes.length; i++) {
            if (seedHashes[hashes[i]] != SeedState.None) revert SeedAlreadyKnown();
            seedHashes[hashes[i]] = SeedState.Committed;
        }
        emit SeedsCommitted(hashes.length);
    }

    function setMinWager(uint256 minWager_) external onlyOwner {
        minWager = minWager_;
        emit MinWagerSet(minWager_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
