pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DirectCall {
    event callresult(string callName, bytes result);

    struct callStruct {
        string callName;
        address target;
        bytes data;
        uint256 value;
    }

    function directCall(callStruct memory data)
        internal
        returns (bool status, bytes memory result)
    {
        require(
            address(this).balance >= data.value,
            string(abi.encodePacked("Insufficient Balance For ", data.callName))
        );

        (status, result) = data.target.call.value(data.value)(data.data);

        require(
            status,
            string(abi.encodePacked("Call Failed For ", data.callName))
        );

        emit callresult(data.callName, result);
    }
}
