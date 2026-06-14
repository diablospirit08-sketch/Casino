// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title VoltVault — the casino cashier (Stake-style custodial model)
/// @notice The chain only handles money in and money out. Players deposit
///         here; their playable balance lives in the house's off-chain ledger,
///         where all games run at full speed with no per-bet transactions.
///         To cash out, the player asks the cashier service for an EIP-712
///         withdrawal voucher (the house debits the ledger, then signs), and
///         redeems it here for real funds.
///
/// Trust model — identical to real custodial casinos: the house is trusted to
/// honor the off-chain ledger. The contract's job is narrower: a voucher can
/// be redeemed once, only by the player it names, only before its deadline,
/// and only if signed by the cashier key. A trust-minimized upgrade (forced
/// exits with challenge periods) is possible later without changing the
/// deposit flow.
contract VoltVault {
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant WITHDRAWAL_TYPEHASH =
        keccak256("Withdrawal(address player,uint256 amount,uint256 nonce,uint256 deadline)");

    bytes32 public immutable DOMAIN_SEPARATOR;

    address public owner;
    /// @notice Hot key the cashier service signs vouchers with. Kept separate
    ///         from the owner so compromising the always-online signer doesn't
    ///         hand over vault governance.
    address public cashierSigner;

    /// @notice Redeemed voucher digests; each voucher is single-use.
    mapping(bytes32 => bool) public usedVouchers;

    bool private locked; // reentrancy guard

    event Deposited(address indexed player, uint256 amount);
    event Withdrawn(address indexed player, uint256 amount, uint256 nonce);
    event HouseWithdraw(address indexed to, uint256 amount);
    event CashierSignerSet(address indexed signer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error Reentrancy();
    error ZeroAddress();
    error ZeroAmount();
    error VoucherExpired();
    error VoucherAlreadyUsed();
    error BadSignature();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert Reentrancy();
        locked = true;
        _;
        locked = false;
    }

    constructor(address cashierSigner_) {
        if (cashierSigner_ == address(0)) revert ZeroAddress();
        owner = msg.sender;
        cashierSigner = cashierSigner_;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("VoltVault")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
        emit OwnershipTransferred(address(0), msg.sender);
        emit CashierSignerSet(cashierSigner_);
    }

    // ---------------------------------------------------------------- player

    /// @notice Fund your casino balance. The cashier service watches this
    ///         event and credits the off-chain ledger.
    function deposit() external payable {
        if (msg.value == 0) revert ZeroAmount();
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Plain transfers count as deposits too, so no accidental send
    ///         goes uncredited.
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Redeem a withdrawal voucher issued by the cashier. The voucher
    ///         is bound to msg.sender, single-use, and expires at `deadline`.
    function withdraw(uint256 amount, uint256 nonce, uint256 deadline, bytes calldata signature)
        external
        nonReentrant
    {
        if (block.timestamp > deadline) revert VoucherExpired();

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(WITHDRAWAL_TYPEHASH, msg.sender, amount, nonce, deadline))
            )
        );
        if (usedVouchers[digest]) revert VoucherAlreadyUsed();
        usedVouchers[digest] = true;

        if (_recover(digest, signature) != cashierSigner) revert BadSignature();

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount, nonce);
    }

    // ----------------------------------------------------------- house ops

    /// @notice House profit out / liquidity management. The off-chain ledger
    ///         is the source of truth for what the house actually owes, so
    ///         the contract cannot bound this — custodial trust applies.
    function houseWithdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit HouseWithdraw(to, amount);
    }

    function setCashierSigner(address signer_) external onlyOwner {
        if (signer_ == address(0)) revert ZeroAddress();
        cashierSigner = signer_;
        emit CashierSignerSet(signer_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ------------------------------------------------------------- internal

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) revert BadSignature();
        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);
        // reject malleable high-s signatures (EIP-2)
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert BadSignature();
        }
        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0)) revert BadSignature();
        return recovered;
    }
}
