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
import { formatUnits } from 'utils/big-number';
import { useWallet } from 'contexts/wallet';
import { useNotifications } from 'contexts/notifications';
import { SUCCESS_COLOR, DANGER_COLOR } from 'config';
import ERC20_ABI from 'abis/ERC20.json';
import sleep from 'utils/sleep';
import Loader from 'components/Loader';

const useStyles = makeStyles(theme => ({
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
}));

export default function() {
  const classes = useStyles();
  const {
    connect,
    isLoaded: walletIsLoaded,
    signer,
    lendingPoolContract,
  } = useWallet();
  const { address } = useWallet();
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [debts, setDebts] = React.useState([]);

  React.useEffect(() => {
    if (!walletIsLoaded) return;
    if (!(lendingPoolContract && address)) return setIsLoaded(true);

    let isMounted = true;
    const unsubs = [() => (isMounted = false)];

    const getDebt = async reserve => {
      const ercContract = new ethers.Contract(reserve, ERC20_ABI, signer);
      const [symbol, amount] = await Promise.all([
        ercContract.symbol(),
        ercContract.balanceOf(address),
      ]);
      return {
        contract: ercContract,
        symbol,
        reserve,
        amount,
      };
    };

    const load = async () => {
      if (isMounted) {
        setIsLoaded(false);
      }
      const reserves = await lendingPoolContract.getReservesList();
      const debts = await Promise.all(reserves.map(getDebt));
      if (isMounted) {
        setDebts(debts.filter(debt => !debt.amount.isZero()));
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
      const onContractEvent = async () => {
        await sleep(1000);
        await load();
      };
      lendingPoolContract.on(borrowEvent, onContractEvent);
      lendingPoolContract.on(repayEvent, onContractEvent);
      unsubs.push(() => lendingPoolContract.off(borrowEvent, onContractEvent));
      unsubs.push(() => lendingPoolContract.off(repayEvent, onContractEvent));
    };

    load();
    subscribe();
    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [lendingPoolContract, address]);

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
      ) : !debts.length ? (
        <div>You have no debts.</div>
      ) : (
        <>
          <h2 className="text-left">Current Borrows</h2>
          <Table className={classes.table} aria-label="debts">
            <TableHead>
              <TableRow>
                <TableCell>Asset</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Leverage</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {debts.map(debt => (
                <Debt key={debt.reserve} {...{ debt }} />
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
}

function Debt({ debt }) {
  const classes = useStyles();
  const { showErrorNotification, tx } = useNotifications();
  // const [isClosing, setIsClosing] = React.useState(false);
  // const {
  //   collateralContracts,
  //   config: { multiCollateralTokenCurrenciesByAddress },
  // } = useWallet();
  // const {
  //   showTxNotification,
  //   showErrorNotification,
  //   showSuccessNotification,
  // } = useNotifications();

  // const close = async () => {
  //   try {
  //     setIsClosing(true);
  //     const tx = await collateralContracts[loan.type].close(loan.id);
  //     showTxNotification(`Closing loan(#${loan.id.toString()})`, tx.hash);
  //     await tx.wait();
  //     showSuccessNotification(
  //       `Loan(#${loan.id.toString()}) successfully closed.`,
  //       tx.hash
  //     );
  //   } catch (e) {
  //     showErrorNotification(e);
  //   } finally {
  //     setIsClosing(false);
  //   }
  // };

  function valueText(value) {
    return `${value}x`;
  }

  return (
    <TableRow>
      <TableCell component="th" scope="row">
        {debt.symbol}
      </TableCell>
      <TableCell>{formatUnits(debt.amount, 18, 2)}</TableCell>
      <TableCell>
        <div className="flex">
          <Box mr={1}>
            <Slider
              defaultValue={2}
              getAriaValueText={valueText}
              aria-labelledby="leverage-slider"
              valueLabelDisplay="auto"
              step={0.1}
              min={1}
              max={3}
              className={classes.leverageSlider}
            />
          </Box>
          <Button color="secondary" variant="outlined">
            APPLY
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
