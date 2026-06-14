// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Interface game contracts use to talk to the bankroll.
interface IBankroll {
    function maxPayout() external view returns (uint256);
    function available() external view returns (uint256);
    function escrowBet(uint256 potentialPayout) external payable;
    function settle(address player, uint256 reservedPayout, uint256 actualPayout) external;
}

/// @title VoltBankroll — the house vault for VOLT casino games
/// @notice Holds the house funds (native coin), collects losing bets, pays out
///         winning ones, and enforces a max-payout cap so a single bet can
///         never drain the house. Only whitelisted game contracts may move
///         player money through it.
///
/// Bet lifecycle (driven by a game contract):
///   1. Player bets at the game. The game computes the potential payout and
///      checks it against maxPayout().
///   2. The game forwards the wager here via escrowBet{value: bet}(potentialPayout),
///      which reserves the potential payout so concurrent bets cannot
///      oversubscribe the bankroll.
///   3. When the bet resolves, the game calls settle(player, reserved, actual):
///      actual = the win amount (0 on a loss). The reservation is released and
///      the player is paid; on a loss the wager simply stays in the vault.
contract VoltBankroll is IBankroll {
    uint256 private constant BPS_DENOMINATOR = 10_000;

    address public owner;

    /// @notice Game contracts allowed to escrow bets and trigger payouts.
    mapping(address => bool) public isGame;

    /// @notice Funds promised to unresolved bets, per game and in total.
    ///         available() excludes these, so house withdrawals and new bets
    ///         can never touch money already owed to in-flight wagers.
    mapping(address => uint256) public reservedOf;
    uint256 public totalReserved;

    /// @notice Largest payout a single bet may win, in basis points of the
    ///         unreserved bankroll. Default 100 = 1%.
    uint256 public maxPayoutBps = 100;

    bool private locked; // reentrancy guard

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event GameSet(address indexed game, bool allowed);
    event MaxPayoutBpsSet(uint256 bps);
    event HouseDeposit(address indexed from, uint256 amount);
    event HouseWithdraw(address indexed to, uint256 amount);
    event BetEscrowed(address indexed game, uint256 wager, uint256 reservedPayout);
    event BetSettled(address indexed game, address indexed player, uint256 reservedPayout, uint256 paidOut);
    event ReservationsCleared(address indexed game, uint256 amount);

    error NotOwner();
    error NotGame();
    error Reentrancy();
    error ZeroAddress();
    error InvalidBps();
    error ExceedsMaxPayout();
    error ExceedsReservation();
    error InsufficientUnreservedFunds();
    error GameStillWhitelisted();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyGame() {
        if (!isGame[msg.sender]) revert NotGame();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert Reentrancy();
        locked = true;
        _;
        locked = false;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ---------------------------------------------------------------- views

    /// @notice Bankroll not promised to any in-flight bet.
    function available() public view returns (uint256) {
        return address(this).balance - totalReserved;
    }

    /// @notice Cap on what a single bet may win right now. Games must check
    ///         their potential payout against this before accepting a wager.
    function maxPayout() external view returns (uint256) {
        return (available() * maxPayoutBps) / BPS_DENOMINATOR;
    }

    // ----------------------------------------------------------- game flow

    /// @notice Take a wager into the vault and reserve its potential payout.
    /// @param potentialPayout The most the player could win from this bet,
    ///        wager included (on a win the full amount is paid from here).
    function escrowBet(uint256 potentialPayout) external payable onlyGame {
        // The wager just received counts toward the bankroll, so it can back
        // part of its own payout; the cap applies to funds beyond it.
        if (potentialPayout > msg.value + (available() - msg.value) * maxPayoutBps / BPS_DENOMINATOR) {
            revert ExceedsMaxPayout();
        }
        reservedOf[msg.sender] += potentialPayout;
        totalReserved += potentialPayout;
        emit BetEscrowed(msg.sender, msg.value, potentialPayout);
    }

    /// @notice Resolve a bet: release its reservation and pay the player.
    /// @param reservedPayout Exactly what was reserved via escrowBet.
    /// @param actualPayout   What the player actually won (0 on a loss).
    function settle(address player, uint256 reservedPayout, uint256 actualPayout)
        external
        onlyGame
        nonReentrant
    {
        if (actualPayout > reservedPayout) revert ExceedsReservation();
        if (reservedPayout > reservedOf[msg.sender]) revert ExceedsReservation();

        reservedOf[msg.sender] -= reservedPayout;
        totalReserved -= reservedPayout;

        if (actualPayout > 0) {
            if (player == address(0)) revert ZeroAddress();
            (bool ok, ) = player.call{value: actualPayout}("");
            if (!ok) revert TransferFailed();
        }
        emit BetSettled(msg.sender, player, reservedPayout, actualPayout);
    }

    // ----------------------------------------------------------- house ops

    /// @notice Fund the bankroll. Anyone may donate; the owner withdraws.
    function deposit() external payable {
        emit HouseDeposit(msg.sender, msg.value);
    }

    receive() external payable {
        emit HouseDeposit(msg.sender, msg.value);
    }

    /// @notice Withdraw house profit. Limited to unreserved funds so money
    ///         owed to pending bets can never leave.
    function withdrawHouseFunds(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > available()) revert InsufficientUnreservedFunds();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit HouseWithdraw(to, amount);
    }

    // ------------------------------------------------------------ governance

    function setGame(address game, bool allowed) external onlyOwner {
        if (game == address(0)) revert ZeroAddress();
        isGame[game] = allowed;
        emit GameSet(game, allowed);
    }

    /// @notice Tune the single-bet payout cap. Hard-limited to 10% so a
    ///         misconfiguration can't expose the whole bankroll to one bet.
    function setMaxPayoutBps(uint256 bps) external onlyOwner {
        if (bps == 0 || bps > 1_000) revert InvalidBps();
        maxPayoutBps = bps;
        emit MaxPayoutBpsSet(bps);
    }

    /// @notice Free reservations left behind by a buggy or abandoned game.
    ///         Only allowed after the game is de-whitelisted, so the owner
    ///         cannot pull the rug on a live game's pending bets.
    function clearReservations(address game) external onlyOwner {
        if (isGame[game]) revert GameStillWhitelisted();
        uint256 amount = reservedOf[game];
        reservedOf[game] = 0;
        totalReserved -= amount;
        emit ReservationsCleared(game, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
