import React from 'react';
import clsx from 'clsx';
import * as ethers from 'ethers';
import { makeStyles } from '@material-ui/core/styles';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Slider,
} from '@material-ui/core';
import { formatUnits, isZero } from 'utils/big-number';
import { constructLoanParameters } from 'utils/takeloan';
import { useWallet } from 'contexts/wallet';
import { useNotifications } from 'contexts/notifications';
import { SUCCESS_COLOR, DANGER_COLOR } from 'config';
import sleep from 'utils/sleep';
import Loader from 'components/Loader';

const useStyles = makeStyles((theme) => ({
  container: {
    '& th, td': {
      borderColor: 'rgba(16, 161, 204, 0.2)',
    },
  },
  error: {
    color: DANGER_COLOR,
  },
  success: {
    color: SUCCESS_COLOR,
  },
  leverageSlider: {
    width: 100,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: '10px',
  },
}));

export default function () {
  const classes = useStyles();
  const {
    connect,
    isLoaded: walletIsLoaded,
    signer,
    wethGatewayContract,
    lendingPoolContract,
    subgraph,
  } = useWallet();
  const { address } = useWallet();
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [deposits, setDeposits] = React.useState([]);
  const [debts, setDebts] = React.useState([]);

  React.useEffect(() => {
    if (!walletIsLoaded) return;
    if (!(signer && lendingPoolContract && wethGatewayContract && address))
      return;

    let isMounted = true;
    const unsubs = [() => (isMounted = false)];

    const load = async () => {
      const deposits = [];
      const debts = [];

      const { users } = await subgraph(
        `
        query ($address: String) {
          users(where: {id: $address}) {
            reserves {
              reserve {
                id
                symbol
                decimals
                usageAsCollateralEnabled
                baseLTVasCollateral
                aToken {
                  underlyingAssetAddress
                }
                vToken {
                  underlyingAssetAddress
                }
                sToken {
                  underlyingAssetAddress
                }
              }
              currentATokenBalance
              currentVariableDebt
              currentStableDebt
            }
          }
        }
        
      `,
        {
          address: address.toLowerCase(),
        }
      );

      users.forEach(({ reserves }) => {
        reserves.forEach(
          ({
            currentATokenBalance,
            currentVariableDebt,
            currentStableDebt,
            reserve,
          }) => {
            if (!isZero(currentATokenBalance)) {
              deposits.push({
                ...reserve,
                amount: currentATokenBalance,
                key: reserve.id,
                usageAsCollateralEnabled: reserve.usageAsCollateralEnabled,
              });
            }
            if (!isZero(currentVariableDebt)) {
              debts.push({
                ...reserve,
                collateral: reserve.aToken.underlyingAssetAddress,
                collateralBalance: currentATokenBalance,
                debtToken: reserve.vToken.underlyingAssetAddress,
                LTV: reserve.baseLTVasCollateral,
                amount: currentVariableDebt,
                variable: true,
                key: `${reserve.id}-variable`,
              });
            }
            if (!isZero(currentStableDebt)) {
              debts.push({
                ...reserve,
                collateral: reserve.aToken.underlyingAssetAddress,
                collateralBalance: currentATokenBalance,
                LTV: reserve.baseLTVasCollateral,
                debtToken: reserve.sToken.underlyingAssetAddress,
                amount: currentStableDebt,
                variable: false,
                key: `${reserve.id}-stable`,
              });
            }
          }
        );
      });

      if (isMounted) {
        setDebts(debts);
        setDeposits(deposits);
        setIsLoaded(true);
      }
    };

    const subscribe = () => {
      const borrowEvent = lendingPoolContract.filters.Borrow(
        null,
        null,
        address
      );
      const repayEvent = lendingPoolContract.filters.Repay(null, address);
      const depositEvent = lendingPoolContract.filters.Deposit(
        null,
        null,
        address
      );
      const withdrawEvent = lendingPoolContract.filters.Withdraw(null, address);
      const onContractEvent = async () => {
        await sleep(1000);
        await load();
      };
      lendingPoolContract.on(borrowEvent, onContractEvent);
      lendingPoolContract.on(repayEvent, onContractEvent);
      lendingPoolContract.on(depositEvent, onContractEvent);
      lendingPoolContract.on(withdrawEvent, onContractEvent);
      unsubs.push(() => lendingPoolContract.off(borrowEvent, onContractEvent));
      unsubs.push(() => lendingPoolContract.off(repayEvent, onContractEvent));
      unsubs.push(() => lendingPoolContract.off(depositEvent, onContractEvent));
      unsubs.push(() =>
        lendingPoolContract.off(withdrawEvent, onContractEvent)
      );
    };

    load();
    subscribe();
    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [
    signer,
    walletIsLoaded,
    lendingPoolContract,
    wethGatewayContract,
    address,
    subgraph,
  ]);

  return (
    <Box className={clsx(classes.container, 'text-center')}>
      {!walletIsLoaded ? null : !address ? (
        <Box py={4}>
          <h2>AAVE 2 Leverage Increase Utility</h2>
          <p>Increase the leverage of your AAVE 2 borrow positions!</p>
          <Button
            color="secondary"
            variant="outlined"
            onClick={() => connect()}
          >
            Connect Wallet
          </Button>
        </Box>
      ) : !isLoaded ? (
        <Loader />
      ) : (
        <Box className={classes.grid}>
          <Box>
            <h2>Your Deposits</h2>
            {!deposits.length ? (
              <Box>You have no deposits.</Box>
            ) : (
              <Table className={classes.table} aria-label="deposit">
                <TableHead>
                  <TableRow>
                    <TableCell>Asset</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deposits.map((deposit) => (
                    <Deposit key={deposit.key} {...{ deposit }} />
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
          <Box>
            <h2>Your Debts</h2>
            {!debts.length ? (
              <Box>You have no debts.</Box>
            ) : (
              <Table className={classes.table} aria-label="debts">
                <TableHead>
                  <TableRow>
                    <TableCell>Asset</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Lever Up</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {debts.map((debt) => (
                    <Debt key={debt.key} {...{ debt }} />
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function Deposit({ deposit }) {
  // const classes = useStyles();

  return (
    <TableRow>
      <TableCell component="th" scope="row">
        {deposit.symbol}
      </TableCell>
      <TableCell>{formatUnits(deposit.amount, deposit.decimals, 2)}</TableCell>
      <TableCell>
        {deposit.usageAsCollateralEnabled ? 'true' : 'false'}
      </TableCell>
    </TableRow>
  );
}

function Debt({ debt }) {
  const classes = useStyles();
  const { tx } = useNotifications();
  const [isWorking, setIsWorking] = React.useState(false);
  const [leverage, setLeverage] = React.useState(2);
  const { leverageContract, address } = useWallet();

  const applyLeverage = async () => {
    try {
      setIsWorking('Applying...');
      await tx('Applying...', 'Applied!', () =>
        leverageContract.letsdoit(
          constructLoanParameters(
            debt.collateral,
            collateralBalance,
            debt.LTV / 10000,
            debt.debtToken,
            address,
            slippage,
            ethers.BigNumber.from(leverage)
          )
        )
      );
    } finally {
      setIsWorking(false);
    }
  };

  function valueText(value) {
    return `${value}x`;
  }

  return (
    <TableRow>
      <TableCell component="th" scope="row">
        {debt.symbol}
      </TableCell>
      <TableCell>{formatUnits(debt.amount, debt.decimals, 2)}</TableCell>
      <TableCell>{debt.variable ? 'variable' : 'stable'}</TableCell>
      <TableCell>
        <Box className="flex">
          <Box mr={1}>
            <Slider
              value={leverage}
              getAriaValueText={valueText}
              aria-labelledby="leverage-slider"
              valueLabelDisplay="auto"
              step={0.1}
              min={1}
              max={3}
              className={classes.leverageSlider}
              disabled={!!isWorking}
              onChange={(event, leverage) => setLeverage(leverage)}
            />
          </Box>
          <Button
            color="secondary"
            variant="outlined"
            disabled={!!isWorking}
            onClick={applyLeverage}
          >
            APPLY
          </Button>
        </Box>
      </TableCell>
    </TableRow>
  );
}
