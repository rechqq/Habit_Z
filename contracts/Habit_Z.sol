pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract HabitTracker is ZamaEthereumConfig {
    struct Habit {
        string name;
        euint32 encryptedValue;
        uint256 publicValue1;
        uint256 publicValue2;
        string description;
        address creator;
        uint256 timestamp;
        uint32 decryptedValue;
        bool isVerified;
    }

    mapping(string => Habit) public habits;
    string[] public habitIds;

    event HabitCreated(string indexed habitId, address indexed creator);
    event DecryptionVerified(string indexed habitId, uint32 decryptedValue);

    constructor() ZamaEthereumConfig() {}

    function createHabit(
        string calldata habitId,
        string calldata name,
        externalEuint32 encryptedValue,
        bytes calldata inputProof,
        uint256 publicValue1,
        uint256 publicValue2,
        string calldata description
    ) external {
        require(bytes(habits[habitId].name).length == 0, "Habit already exists");
        require(FHE.isInitialized(FHE.fromExternal(encryptedValue, inputProof)), "Invalid encrypted input");

        habits[habitId] = Habit({
            name: name,
            encryptedValue: FHE.fromExternal(encryptedValue, inputProof),
            publicValue1: publicValue1,
            publicValue2: publicValue2,
            description: description,
            creator: msg.sender,
            timestamp: block.timestamp,
            decryptedValue: 0,
            isVerified: false
        });

        FHE.allowThis(habits[habitId].encryptedValue);
        FHE.makePubliclyDecryptable(habits[habitId].encryptedValue);
        habitIds.push(habitId);

        emit HabitCreated(habitId, msg.sender);
    }

    function verifyDecryption(
        string calldata habitId, 
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external {
        require(bytes(habits[habitId].name).length > 0, "Habit does not exist");
        require(!habits[habitId].isVerified, "Data already verified");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(habits[habitId].encryptedValue);

        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);
        uint32 decodedValue = abi.decode(abiEncodedClearValue, (uint32));

        habits[habitId].decryptedValue = decodedValue;
        habits[habitId].isVerified = true;

        emit DecryptionVerified(habitId, decodedValue);
    }

    function getEncryptedValue(string calldata habitId) external view returns (euint32) {
        require(bytes(habits[habitId].name).length > 0, "Habit does not exist");
        return habits[habitId].encryptedValue;
    }

    function getHabit(string calldata habitId) external view returns (
        string memory name,
        uint256 publicValue1,
        uint256 publicValue2,
        string memory description,
        address creator,
        uint256 timestamp,
        bool isVerified,
        uint32 decryptedValue
    ) {
        require(bytes(habits[habitId].name).length > 0, "Habit does not exist");
        Habit storage data = habits[habitId];

        return (
            data.name,
            data.publicValue1,
            data.publicValue2,
            data.description,
            data.creator,
            data.timestamp,
            data.isVerified,
            data.decryptedValue
        );
    }

    function getAllHabitIds() external view returns (string[] memory) {
        return habitIds;
    }

    function isAvailable() public pure returns (bool) {
        return true;
    }
}

