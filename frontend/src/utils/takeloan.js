// Require Web3 Module
var Web3 = require('web3');
const axios = require('axios');
require('dotenv').config({ path: '../.env' });

web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

// FlashLoan Contract
var FlashLoanContractABI = require('./ABIs/flashLoanContract').ABI;
var FlashLoanContractAddress = '0x958Eb4058a813daC20d875d3990cbb044B826ED8';

async function execution() {
  // Contracts Instances
  var flashLoanContract = new web3.eth.Contract(
    FlashLoanContractABI,
    FlashLoanContractAddress
  );
  /* Arguments Construction */
  var loanTokenAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
  var loanAmount = web3.utils.toWei((1000).toString(), 'ether');
  var toTokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  var Slippage = 1;

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
        toTokenAddress +
        '&amount=' +
        loanAmount +
        '&fromAddress=' +
        FlashLoanContractAddress +
        '&slippage=' +
        Slippage +
        '&disableEstimate=true'
    )
    .then(response => {
      oneinchData = response.data;
    })
    .catch(error => {});

  // Approval for SwapBack
  let swapBackAmount = oneinchData.toTokenAmount * ((100 - Slippage) / 100);
  var swapBackApprovalData = '';
  await axios
    .get(
      'https://api.1inch.exchange/v2.0/approve/calldata?amount=' +
        swapBackAmount +
        '&tokenAddress=' +
        toTokenAddress
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
        toTokenAddress +
        '&toTokenAddress=' +
        loanTokenAddress +
        '&amount=' +
        swapBackAmount +
        '&fromAddress=' +
        FlashLoanContractAddress +
        '&slippage=' +
        Slippage +
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
      callName: 'Approval',
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
      callName: 'Approval',
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
  var Tx = require('ethereumjs-tx').Transaction;
  var privateKey = Buffer.from(process.env.PRIVATE_KEY, 'hex');
  var fromAddress = process.env.WALLET_ADDRESS;

  txTarget = FlashLoanContractAddress;
  txdata = flashLoanContract.methods
    .letsdoit(loanTokenAddress, loanAmount, operations)
    .encodeABI();
  txvalue = web3.utils.toHex(web3.utils.toWei((0).toString(), 'ether')); // Extra Money for Urgent Times ;)
  txnonce = web3.utils.toHex(await web3.eth.getTransactionCount(fromAddress));

  var rawTx = {
    nonce: txnonce,
    gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
    gasLimit: web3.utils.toHex(
      await web3.eth.estimateGas({
        from: fromAddress,
        nonce: txnonce,
        to: txTarget,
        data: txdata,
        value: txvalue,
      })
    ),
    to: txTarget,
    value: txvalue,
    data: txdata,
  };

  var tx = new Tx(rawTx);
  tx.sign(privateKey);

  var serializedTx = tx.serialize();

  web3.eth
    .sendSignedTransaction('0x' + serializedTx.toString('hex'))
    .on('receipt', console.log);
}
