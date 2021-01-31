import NETWORKS from 'networks.json';
import { ethers } from 'ethers';
import { useWallet } from 'contexts/wallet';
const axios = require('axios');
const { lendingPoolContract, priceOracleContract } = useWallet();

export async function constructLoanParameters(
  collateralToken,
  collateralAmount,
  collateralLTV,
  debtToken,
  onbehalf,
  slippage,
  leverage
) {
  /* Arguments Construction */
  var loanTokenAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';

  var CollateralInLoanToken =
    priceOracleContract.getAssetPrice(collateralToken) /
    priceOracleContract.getAssetPrice(loanTokenAddress);

  var LoanTokenInDebt =
    priceOracleContract.getAssetPrice(loanTokenAddress) /
    priceOracleContract.getAssetPrice(debtToken);

  var loanAmount = ethers.utils.parseEther(
    (collateralAmount * (leverage - 1) * CollateralInLoanToken).toString()
  );

  var FlashLoanContractAddress = NETWORKS['flashLoanAddress'];

  // Approval for Swap
  var swapApprovalData = '';
  await axios
    .get(
      'https://api.1inch.exchange/v2.0/approve/calldata?amount=' +
        loanAmount +
        '&tokenAddress=' +
        loanTokenAddress
    )
    .then(response => {
      swapApprovalData = response.data;
    })
    .catch(error => {});

  // 1Inch Swap
  var oneinchData = '';
  await axios
    .get(
      'https://api.1inch.exchange/v2.0/swap?fromTokenAddress=' +
        loanTokenAddress +
        '&toTokenAddress=' +
        collateralToken +
        '&amount=' +
        loanAmount +
        '&fromAddress=' +
        FlashLoanContractAddress +
        '&slippage=' +
        slippage +
        '&disableEstimate=true'
    )
    .then(response => {
      oneinchData = response.data;
    })
    .catch(error => {});

  // Approval for SwapBack
  let swapBackAmount = oneinchData.toTokenAmount * ((100 - slippage) / 100);
  var swapBackApprovalData = '';
  await axios
    .get(
      'https://api.1inch.exchange/v2.0/approve/calldata?amount=' +
        swapBackAmount +
        '&tokenAddress=' +
        collateralToken
    )
    .then(response => {
      swapBackApprovalData = response.data;
    })
    .catch(error => {});

  // 1inch SwapBack
  let oneinchSwapBackData = '';
  await axios
    .get(
      'https://api.1inch.exchange/v2.0/swap?fromTokenAddress=' +
        collateralToken +
        '&toTokenAddress=' +
        loanTokenAddress +
        '&amount=' +
        swapBackAmount +
        '&fromAddress=' +
        FlashLoanContractAddress +
        '&slippage=' +
        slippage +
        '&disableEstimate=true'
    )
    .then(response => {
      oneinchSwapBackData = response.data;
    })
    .catch(error => {});

  // Operations
  var operations = [
    {
      // Approval for Swap
      callName: 'Approval_TO_TARGET',
      target: swapApprovalData.to,
      data: swapApprovalData.data,
      value: 0,
    },
    {
      // Swap
      callName: 'SWAP_TO_TARGET',
      target: oneinchData.tx.to,
      data: oneinchData.tx.data,
      value: oneinchData.tx.value,
    },
    {
      // Swap
      callName: 'Deposit',
      target: lendingPoolContract.address,
      data: lendingPoolContract.interface.functions.encode.deposit(
        collateralToken,
        swapBackAmount,
        onbehalf,
        0
      ),
      value: 0,
    },
    {
      // Swap
      callName: 'Borrow',
      target: lendingPoolContract.address,
      data: lendingPoolContract.interface.functions.encode.borrow(
        debtToken,
        loanAmount * LoanTokenInDebt,
        1,
        0,
        onbehalf
      ),
      value: 0,
    },
    {
      // Approval for SwapBack
      callName: 'Approval_TO_SWAPBACK',
      target: swapBackApprovalData.to,
      data: swapBackApprovalData.data,
      value: 0,
    },
    {
      // SwapBack
      callName: 'SWAP_BACK',
      target: oneinchSwapBackData.tx.to,
      data: oneinchSwapBackData.tx.data,
      value: oneinchSwapBackData.tx.value,
    },
  ];
  /* Transaction Build & Sign & Send */
  return loanTokenAddress, loanAmount, operations;
}
