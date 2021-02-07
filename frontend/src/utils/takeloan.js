import NETWORKS from 'networks.json';
import { ethers } from 'ethers';
import { useWallet } from 'contexts/wallet';
import { useNotifications } from 'contexts/notifications';
import { Button } from '@material-ui/core';
import { Big } from 'utils/big-number';
import React from 'react';
const axios = require('axios');

export function LeverageButton({ vars }) {
  const [LevButton, setLevButton] = React.useState(
    <p>Checking the Values...</p>
  );

  const btn = async () => setLevButton(await DoLeverage({ vars }));
  btn();

  return LevButton;
}

async function DoLeverage({ vars }) {
  const { tx } = useNotifications();
  const { leverageContract, address } = useWallet();

  var [
    collateralToken,
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
      await tx(
        'Applying...',
        'Applied!',
        async () =>
          await leverageContract.letsdoit(
            vars.collateral.address,
            loanAmount,
            operations
          )
      );
    } finally {
    }
  };

  const requiredUserTransfer = userTransferAmount;
  const debtBalance = await vars.collateral.balanceOf(address);
  const debtAllowance = await vars.collateral.allowance(
    address,
    leverageContract.address
  );

  let ApplyButton;
  if (requiredUserTransfer > debtBalance)
    ApplyButton = (
      <Button
        style={{ position: 'relative', top: 20 }}
        color="secondary"
        variant="outlined"
        disabled={true}
      >
        Insufficient Balance!
      </Button>
    );
  else if (requiredUserTransfer < debtAllowance)
    ApplyButton = (
      <Button
        style={{ position: 'relative', top: 20 }}
        color="secondary"
        variant="outlined"
        disabled={false}
        onClick={async () =>
          await vars.collateralToken.approve(
            leverageContract.address,
            debtAllowance
          )
        }
      >
        Unlock Debt Token
      </Button>
    );
  else
    ApplyButton = (
      <Button
        style={{ position: 'relative', top: 20 }}
        color="secondary"
        variant="outlined"
        disabled={false}
        onClick={() => applyLeverage()}
      >
        Apply Leverage
      </Button>
    );

  return ApplyButton;
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

  var LoanTokenInDebt =
    (await priceOracleContract.getAssetPrice(collateralToken.address)) /
    (await priceOracleContract.getAssetPrice(debtToken.address));

  var FlashLoanContractAddress = NETWORKS.mainnet.flashLoanAddress;

  const slippageAmount = (100 - slippage) / 100;

  var loanAmount = collateralAmount * leverage;

  let borrowAmount = ethers.utils.parseEther(
    (loanAmount * LoanTokenInDebt * collateralLTV * slippageAmount).toFixed(6)
  );

  let userTransferAmount = ethers.utils.parseEther(
    (loanAmount - loanAmount * collateralLTV * slippageAmount).toFixed(6)
  );

  loanAmount = ethers.utils.parseEther(loanAmount.toFixed(6));

  // Approval for SwapBack
  var swapBackApprovalData = '';
  await axios
    .get(
      'https://api.1inch.exchange/v2.0/approve/calldata?amount=' +
        borrowAmount +
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
        collateralToken.address +
        '&amount=' +
        borrowAmount +
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
      callName: 'Deposit',
      target: lendingPoolContract.address,
      data: lendingPoolContract.interface.encodeFunctionData('deposit', [
        collateralToken.address,
        loanAmount,
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
        borrowAmount,
        1,
        0,
        onbehalf,
      ]),
      value: 0,
    },
    {
      callName: 'USER_Transfer',
      target: debtToken.address,
      data: collateralToken.interface.encodeFunctionData('transfer', [
        leverageContract.address,
        userTransferAmount,
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
  return [collateralToken.address, loanAmount, operations, userTransferAmount];
}
