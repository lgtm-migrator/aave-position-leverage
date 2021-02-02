import React from 'react';
import clsx from 'clsx';
import { HashRouter as Router } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Paper } from '@material-ui/core';
import { ROUTER_BASE_NAME } from 'config';
import { useWallet } from 'contexts/wallet';
import Loader from 'components/Loader';
import Header from './Header';
import Leverage from './Leverage';
import WrongNetwork from './WrongNetwork';

const useStyles = makeStyles(theme => ({
  container: {
    width: '960px',
    margin: '0 auto',
    padding: '100px 0 30px',
    position: 'relative',
    [theme.breakpoints.down('sm')]: {
      padding: '70px 0 10px',
      width: 'auto',
    },
  },
}));

export default function App() {
  const classes = useStyles();
  const { isLoaded: walletIsLoaded } = useWallet();
  return (
    <Box className={clsx(classes.container)}>
      <Router basename={ROUTER_BASE_NAME}>
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

        {<WrongNetwork />}
      </Router>
    </Box>
  );
}
