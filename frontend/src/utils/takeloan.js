import NETWORKS from 'networks.json';
import { ethers } from 'ethers';
import { useWallet } from 'contexts/wallet';
import { useNotifications } from 'contexts/notifications';
import { Button } from '@material-ui/core';
import { Big } from 'utils/big-number';
import React from 'react';
const axios = require('axios');

export async function DoLeverage({ vars }) {
  const { tx } = useNotifications();
  const { leverageContract, address } = useWallet();

  var [
    loanTokenAddress,
    loanAmount,
    operations,
    userTransferAmount,
  ] = await ConstructLoanParameters(
    vars.collateral,
    vars.collateralBalance,
    vars.LTV / 10000,
    vars.debtToken,
    address,
    vars.slippage,
    vars.leverage
  );
  const applyLeverage = async () => {
    try {
      await tx('Applying...', 'Applied!', () =>
        leverageContract.letsdoit(loanTokenAddress, loanAmount, operations)
      );
    } finally {
    }
  };

  const requiredUserTransfer = userTransferAmount;
  const debtBalance = vars.debtToken.balanceOf(address);
  const debtAllowance = vars.debtToken.allowance(
    address,
    leverageContract.address
  );

  let ApplyButton;
  if (requiredUserTransfer > debtBalance)
    ApplyButton = (
      <Button color="secondary" variant="outlined" disabled={true}>
        Insufficient Balance!
      </Button>
    );
  else if (requiredUserTransfer < debtAllowance)
    ApplyButton = (
      <Button
        color="secondary"
        variant="outlined"
        disabled={false}
        onClick={async () =>
          await vars.debtToken.approve(leverageContract.address, debtAllowance)
        }
      >
        Unlock Debt Token
      </Button>
    );
  else
    ApplyButton = (
      <Button
        color="secondary"
        variant="outlined"
        disabled={false}
        onClick={() => applyLeverage()}
      >
        Apply Leverage
      </Button>
    );

  return <ApplyButton></ApplyButton>;
}

async function ConstructLoanParameters(
  collateralToken,
  collateralAmount,
  collateralLTV,
  debtToken,
  onbehalf,
  slippage,
  leverage
) {
  /* Arguments Construction */
  const {
    lendingPoolContract,
    leverageContract,
    priceOracleContract,
  } = useWallet();

  var loanTokenAddress = collateralToken.address;

  var CollateralInLoanToken =
    (await priceOracleContract.getAssetPrice(collateralToken.address)) /
    (await priceOracleContract.getAssetPrice(loanTokenAddress));

  var LoanTokenInDebt =
    (await priceOracleContract.getAssetPrice(loanTokenAddress)) /
    (await priceOracleContract.getAssetPrice(debtToken.address));

  var loanAmount = ethers.utils.parseEther(
    (collateralAmount * (leverage - 1) * CollateralInLoanToken).toString()
  );

  var FlashLoanContractAddress = NETWORKS.mainnet.flashLoanAddress;

  const slippageAmount = (100 - slippage) / 100;

  let loanAmountinDebt = loanAmount * LoanTokenInDebt;

  let borrowAmount = loanAmountinDebt * collateralLTV * slippageAmount;

  let userTransferAmount = loanAmountinDebt - borrowAmount;

  let totalDebt = userTransferAmount + borrowAmount;

  // Approval for SwapBack
  var swapBackApprovalData = '';
  await axios
    .get(
      'https://api.1inch.exchange/v2.0/approve/calldata?amount=' +
        totalDebt +
        '&tokenAddress=' +
        debtToken.address
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
        debtToken.address +
        '&toTokenAddress=' +
        loanTokenAddress +
        '&amount=' +
        totalDebt +
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

  const x = ethers.BigNumber.from(10);

  // Operations
  var operations = [
    {
      callName: 'Deposit',
      target: lendingPoolContract.address,
      data: lendingPoolContract.interface.encodeFunctionData('deposit', [
        collateralToken.address,
        ethers.BigNumber.from(loanAmount / 10 ** 16).mul(10 ** 16),
        onbehalf,
        0,
      ]),
      value: 0,
    },
    {
      callName: 'Borrow',
      target: lendingPoolContract.address,
      data: lendingPoolContract.interface.encodeFunctionData('borrow', [
        debtToken.address,
        ethers.BigNumber.from(borrowAmount / 10 ** 16).mul(10 ** 16),
        1,
        0,
        onbehalf,
      ]),
      value: 0,
    },
    {
      callName: 'USER_Transfer',
      target: debtToken.address,
      data: lendingPoolContract.interface.encodeFunctionData('transfer', [
        leverageContract.address,
        ethers.BigNumber.from(userTransferAmount / 10 ** 16).mul(10 ** 16),
      ]),
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
      value: 0,
    },
  ];
  /* Transaction Build & Sign & Send */
  debugger;
  alert(loanTokenAddress, loanAmount, operations, userTransferAmount);
  return [loanTokenAddress, loanAmount, operations, userTransferAmount];
}
