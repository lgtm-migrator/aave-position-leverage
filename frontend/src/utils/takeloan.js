import NETWORKS from 'networks.json';
import STABLE_DEBT_ABI from 'abis/StableDebtToken.json';
import { ethers } from 'ethers';
import { UseWallet } from 'contexts/wallet';
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
  const {
    lendingPoolContract,
    leverageContract,
    priceOracleContract,
    dataProviderContract,
    address,
    signer,
  } = UseWallet();

  let collateralLTV = vars.LTV / 10000;
  const slippageAmount = (100 - vars.slippage) / 100;

  var LoanTokenInDebt;
  if (vars.collateral.address == '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')
    LoanTokenInDebt =
      10 ** 18 /
      (await priceOracleContract.getAssetPrice(vars.debtToken.address));
  else
    LoanTokenInDebt =
      (await priceOracleContract.getAssetPrice(vars.collateral.address)) /
      (await priceOracleContract.getAssetPrice(vars.debtToken.address));

  var loanAmount = (vars.collateralBalance * vars.leverage).toString();

  var borrowAmount = ethers.utils.parseEther(
    (loanAmount * LoanTokenInDebt * collateralLTV * slippageAmount).toString()
  );

  var userTransferAmount = ethers.utils.parseEther(
    (loanAmount - loanAmount * collateralLTV * slippageAmount).toString()
  );

  loanAmount = ethers.utils.parseEther(loanAmount);

  var operations = async () =>
    await ConstructOperations(
      vars.collateral,
      vars.debtToken,
      address,
      vars.slippage,
      loanAmount,
      borrowAmount,
      userTransferAmount,
      {
        lendingPoolContract: lendingPoolContract,
        leverageContract: leverageContract,
      }
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
            await operations()
          )
      );
    } finally {
    }
  };

  var collateralBalance = await vars.collateral.balanceOf(address);
  var collateralAllowance = await vars.collateral.allowance(
    address,
    leverageContract.address
  );
  var stableDebtToken = new ethers.Contract(
    await dataProviderContract.getReserveTokensAddresses(debtToken)[1],
    STABLE_DEBT_ABI,
    signer
  );
  var borrowAllowance = stableDebtToken.borrowAllowance(
    address,
    leverageContract.address
  );

  //alert(collateralAllowance);

  let ApplyButton;
  if (userTransferAmount.gte(collateralBalance))
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
  else if (userTransferAmount.gt(collateralAllowance))
    ApplyButton = (
      <Button
        style={{ position: 'relative', top: 20 }}
        color="secondary"
        variant="outlined"
        disabled={false}
        onClick={async () =>
          await vars.collateral.approve(
            leverageContract.address,
            userTransferAmount
          )
        }
      >
        Unlock Collateral Token
      </Button>
    );
  else if (borrowAmount.gt(borrowAllowance))
    ApplyButton = (
      <Button
        style={{ position: 'relative', top: 20 }}
        color="secondary"
        variant="outlined"
        disabled={false}
        onClick={async () =>
          await stableDebtToken.approveDelegation(
            leverageContract.address,
            borrowAmount
          )
        }
      >
        Approve Delegation
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

async function ConstructOperations(
  collateralToken,
  debtToken,
  onbehalf,
  slippage,
  loanAmount,
  borrowAmount,
  userTransferAmount,
  Contracts
) {
  /* Arguments Construction */
  var FlashLoanContractAddress = NETWORKS.mainnet.flashLoanAddress;

  console.log(borrowAmount);

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

  const x =
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
    '&disableEstimate=true';

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
      callName: 'LendingPool_APPROVE',
      target: collateralToken.address,
      data: collateralToken.interface.encodeFunctionData('approve', [
        Contracts.lendingPoolContract.address,
        loanAmount,
      ]),
      value: 0,
    },
    {
      callName: 'Deposit',
      target: Contracts.lendingPoolContract.address,
      data: Contracts.lendingPoolContract.interface.encodeFunctionData(
        'deposit',
        [collateralToken.address, loanAmount, onbehalf, 0]
      ),
      value: 0,
    },
    {
      callName: 'Borrow',
      target: Contracts.lendingPoolContract.address,
      data: Contracts.lendingPoolContract.interface.encodeFunctionData(
        'borrow',
        [collateralToken.address, borrowAmount, 1, 0, onbehalf]
      ),
      value: 0,
    },
    {
      callName: 'USER_Transfer',
      target: debtToken.address,
      data: collateralToken.interface.encodeFunctionData('transferFrom', [
        onbehalf,
        Contracts.leverageContract.address,
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
  return operations;
}
