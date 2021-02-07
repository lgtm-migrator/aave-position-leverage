import React from 'react';
import clsx from 'clsx';
import { HashRouter as Router } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Paper } from '@material-ui/core';
import { ROUTER_BASE_NAME } from 'config';
import { UseWallet } from 'contexts/wallet';
import Loader from 'components/Loader';
import Header from './Header';
import Leverage from './Leverage';
import NewLoan from './newLoan';
import WrongNetwork from './WrongNetwork';

const useStyles = makeStyles(theme => ({
  container: {
    width: '960px',
    margin: '0 auto',
    padding: '100px 0 30px',
    right: '-300px',
    position: 'relative',
    [theme.breakpoints.down('sm')]: {
      padding: '70px 0 10px',
      width: 'auto',
    },
  },
  newLoanContainer: {
    width: '500px',
    height: '500px',
    top: -180,
    left: -600,
    margin: '0 auto',
    padding: '0px 0 30px',
    position: 'relative',
    [theme.breakpoints.down('sm')]: {
      padding: '70px 0 10px',
      width: 'auto',
    },
  },
}));

export default function App() {
  const classes = useStyles();
  const { isLoaded: walletIsLoaded } = UseWallet();
  return (
    <Box>
      <Router basename={ROUTER_BASE_NAME}>
        <Box className={clsx(classes.container)}>
          <Header />

          <Paper>
            <Box p={4}>
              {!walletIsLoaded ? (
                <Box pt={20}>
                  <Loader />
                </Box>
              ) : (
                <Leverage />
              )}
            </Box>
          </Paper>
        </Box>
        <Paper className={clsx(classes.newLoanContainer)}>
          <Box p={4}>
            {!walletIsLoaded ? (
              <Box pt={20}>
                <Loader />
              </Box>
            ) : (
              <NewLoan />
            )}
          </Box>
        </Paper>
        {<WrongNetwork />}
      </Router>
    </Box>
  );
}
