pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

// AAVE
import "./aave/FlashLoanReceiverBase.sol";
import "./aave/ILendingPoolAddressesProvider.sol";
import "./aave/ILendingPool.sol";

// ERC20
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Utils
import "./utils/DirectCall.sol";

contract FlashLoan is DirectCall, Ownable, FlashLoanReceiverBase {
    struct LoanData {
        callStruct[] postLoanActions;
    }

    constructor(address _addressProvider)
        public
        FlashLoanReceiverBase(_addressProvider)
    {}

    event loanExecutionSuccess(address owner);

    /*  function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = byte(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
}*/

    // This is the function that will be called postLoan
    // i.e. Encode the logic to handle your flashloaned funds here
    function executeOperation(
        address _reserve,
        uint256 _amount,
        uint256 _fee,
        bytes calldata _params
    ) external override {
        //require(msg.sender == SoloAddress, "Unauthorized Access!");
        require(
            _amount <= getBalanceInternal(address(this), _reserve),
            "Invalid balance, was the flashLoan successful?"
        );

        LoanData memory myLoanData = abi.decode(_params, (LoanData));

        //// Logic
        for (uint256 i = 0; i < myLoanData.postLoanActions.length; i++) {
            // Call Functions
            directCall(myLoanData.postLoanActions[i]);
        }

        uint256 totalDebt = _amount.add(_fee);
        uint256 balOfLoanedToken = IERC20(_reserve).balanceOf(address(this));
        require(
            balOfLoanedToken >= totalDebt,
            "Not enough funds to repay AAVE loan!"
        );

        transferFundsBackToPoolInternal(_reserve, totalDebt);

        emit loanExecutionSuccess(msg.sender);
    }

    function initiateFlashLoan(
        address _Loantoken,
        uint256 _amount,
        callStruct[] memory postLoanActions
    ) private {
        ILendingPool lendingPool =
            ILendingPool(addressesProvider.getLendingPool());
        lendingPool.flashLoan(
            address(this),
            _Loantoken,
            _amount,
            abi.encode(LoanData({postLoanActions: postLoanActions}))
        );
    }

    function letsdoit(
        address _LoanToken,
        uint256 _LoanAmount,
        callStruct[] memory postLoanActions
    ) external onlyOwner {
        initiateFlashLoan(_LoanToken, _LoanAmount, postLoanActions);
    }

    function changeOwner(address newOwner) external onlyOwner {
        transferOwnership(newOwner);
    }

    function withdraweth(uint256 _Amount) external onlyOwner {
        msg.sender.transfer(_Amount);
    }

    function withdrawerc(address _Token, uint256 _Amount) external onlyOwner {
        IERC20(_Token).transfer(msg.sender, _Amount);
    }
}
