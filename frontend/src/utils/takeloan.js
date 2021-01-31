import { ethers } from 'ethers';
import * as request from 'request';

export async function constructLoanParameters({
  collateralToken,
  collateralAmount,
  collateralLTV,
  debtToken,
  onbehalf,
  slippage,
  leverage,
  lendingPoolContract,
  priceOracleContract,
  flashLoanContractAddress,
}) {
  const collateralInLoanToken =
    (await priceOracleContract.getAssetPrice(collateralToken)) /
    (await priceOracleContract.getAssetPrice(debtToken));

  const debtAmount = ethers.utils.parseEther(
    (collateralAmount * (leverage - 1) * collateralInLoanToken).toString()
  );

  // Approval for Swap
  const swapApprovalData = await oneInch('/approve/calldata', {
    amount: debtAmount,
    tokenAddress: debtToken,
  });

  // 1Inch Swap
  const oneinchData = await oneInch('/swap', {
    fromTokenAddress: debtToken,
    toTokenAddress: collateralToken,
    amount: debtAmount,
    fromAddress: flashLoanContractAddress,
    slippage,
    disableEstimate: true,
  });

  // Approval for SwapBack
  const swapBackAmount = oneinchData.toTokenAmount * ((100 - slippage) / 100);
  const swapBackApprovalData = await oneInch('/approve/calldata', {
    amount: swapBackAmount,
    tokenAddress: collateralToken,
  });

  // 1inch SwapBack
  const oneinchSwapBackData = await oneInch('/swap', {
    fromTokenAddress: collateralToken,
    toTokenAddress: debtToken,
    amount: swapBackAmount,
    fromAddress: flashLoanContractAddress,
    slippage,
    disableEstimate: true,
  });

  // Operations
  const operations = [
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
        debtAmount * collateralInLoanToken,
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
  return [debtToken, debtAmount, operations];
}

async function oneInch(url, query) {
  return request.get(`https://api.1inch.exchange/v2.0/${url}`, query);
}
