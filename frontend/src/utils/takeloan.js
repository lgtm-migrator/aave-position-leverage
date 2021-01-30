import { ethers } from 'ethers';
const axios = require('axios');

export async function constructLoanParameters(
  collateralAmount,
  collateralToken,
  slippage,
  leverage
) {
  /* Arguments Construction */
  var loanTokenAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
  loanAmount = ethers.utils.parseEther(
    (collateralAmount * (leverage - 1)).toString()
  );

  // Approval for Swap
  var swapApprovalData = '';
  await axios
    .get(
      'https://api.1inch.exchange/v2.0/approve/calldata?amount=' +
        loanAmount +
        '&tokenAddress=' +
        loanTokenAddress
    )
    .then((response) => {
      swapApprovalData = response.data;
    })
    .catch((error) => {});

  // 1Inch Swap
  var oneinchData = '';
  await axios
    .get(
      'https://api.1inch.exchange/v2.0/swap?fromTokenAddress=' +
        loanTokenAddress +
        '&collateralToken=' +
        collateralToken +
        '&amount=' +
        loanAmount +
        '&fromAddress=' +
        FlashLoanContractAddress +
        '&slippage=' +
        slippage +
        '&disableEstimate=true'
    )
    .then((response) => {
      oneinchData = response.data;
    })
    .catch((error) => {});

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
    .then((response) => {
      swapBackApprovalData = response.data;
    })
    .catch((error) => {});

  // 1inch SwapBack
  let oneinchSwapBackData = '';
  await axios
    .get(
      'https://api.1inch.exchange/v2.0/swap?fromTokenAddress=' +
        collateralToken +
        '&collateralToken=' +
        loanTokenAddress +
        '&amount=' +
        swapBackAmount +
        '&fromAddress=' +
        FlashLoanContractAddress +
        '&slippage=' +
        slippage +
        '&disableEstimate=true'
    )
    .then((response) => {
      oneinchSwapBackData = response.data;
    })
    .catch((error) => {});

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
    /* TODO */
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
