// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMessageTransmitter {
    function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool success);
}

/// @title brandmystuff cross-chain payout relayer
/// @notice Completes Circle CCTP transfers that brandmystuff burns on Sui for holders who chose
/// this chain for their revenue share, and records each delivery as an on-chain event.
///
/// Funds never touch this contract: Circle's TokenMessenger mints USDC straight to the holder's
/// `mintRecipient`. Sui burns name this contract as `destinationCaller`, so every payout is
/// completed (and recorded) through here. Recipient and amount are decoded from Circle's
/// attested message, so the emitted event can't misstate either.
contract BrandMyStuffPayoutRelayer {
    uint32 public constant SUI_DOMAIN = 8;

    IMessageTransmitter public immutable messageTransmitter;
    address public owner;
    mapping(address => bool) public isRelayer;

    uint256 public payouts;
    uint256 public totalDelivered;

    /// @param suiHolder the holder's Sui address (32 bytes)
    /// @param recipient the EVM address the USDC was minted to
    /// @param amount USDC amount (6 decimals)
    /// @param offeringId the Sui offering the revenue came from
    /// @param suiTx the Sui transaction that released + burned it (base58 digest, hashed)
    /// @param nonce the CCTP message nonce (unique per source domain)
    event PayoutDelivered(
        bytes32 indexed suiHolder,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed offeringId,
        bytes32 suiTx,
        uint64 nonce
    );
    event RelayerSet(address relayer, bool allowed);
    event OwnerChanged(address owner);

    error NotRelayer();
    error NotOwner();
    error BadMessage();
    error NotFromSui(uint32 sourceDomain);
    error ReceiveFailed();

    constructor(address _messageTransmitter) {
        messageTransmitter = IMessageTransmitter(_messageTransmitter);
        owner = msg.sender;
        isRelayer[msg.sender] = true;
        emit RelayerSet(msg.sender, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        isRelayer[relayer] = allowed;
        emit RelayerSet(relayer, allowed);
    }

    function transferOwnership(address next) external onlyOwner {
        owner = next;
        emit OwnerChanged(next);
    }

    /// @notice Completes one CCTP payout. `message` + `attestation` come from Circle's attestation API.
    function deliver(bytes calldata message, bytes calldata attestation, bytes32 suiHolder, bytes32 offeringId, bytes32 suiTx)
        external
        returns (address recipient, uint256 amount)
    {
        if (!isRelayer[msg.sender]) revert NotRelayer();
        // CCTP V1 message: 116-byte header + 132-byte burn body.
        if (message.length < 248) revert BadMessage();
        uint32 sourceDomain = uint32(bytes4(message[4:8]));
        if (sourceDomain != SUI_DOMAIN) revert NotFromSui(sourceDomain);
        uint64 nonce = uint64(bytes8(message[12:20]));
        recipient = address(uint160(uint256(bytes32(message[152:184]))));
        amount = uint256(bytes32(message[184:216]));

        if (!messageTransmitter.receiveMessage(message, attestation)) revert ReceiveFailed();

        payouts += 1;
        totalDelivered += amount;
        emit PayoutDelivered(suiHolder, recipient, amount, offeringId, suiTx, nonce);
    }
}
