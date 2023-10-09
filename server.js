const express = require('express');
const { Web3 } = require('web3');



const app = express();
const PORT = 3000;

const WEB3_PROVIDER = 'https://rpc-mumbai.maticvigil.com/';  // Mumbai Testnet RPC
const web3 = new Web3(WEB3_PROVIDER);

app.use(express.json());


//My Account & PK
const ownerAccount = '';                      // Replace with your account address
const privateKey = '';  // Replace with your private key

//Contracts
const UBGTokenData = require('./UBGToken.json');
const EscrowData = require('./Escrow.json');
const UnseenBattlegroundsData = require('./UnseenBattlegrounds.json');
const UBGAssetsData = require('./UBGAssets.json');


const UBGToken = new web3.eth.Contract(UBGTokenData.abi, UBGTokenData.address);
const Escrow = new web3.eth.Contract(EscrowData.abi, EscrowData.address);
const UnseenBattlegrounds = new web3.eth.Contract(UnseenBattlegroundsData.abi, UnseenBattlegroundsData.address);
const UBGAssets = new web3.eth.Contract(UBGAssetsData.abi, UBGAssetsData.address);


//Token addresses for supported ERC 20 tokens
const TOKEN_ADDRESSES = {
    "UBG":      "0x8F3f1F2d7508149bb39191706B884897fE52B569",           // UBGToken address
    "MATIC":    "0x0000000000000000000000000000000000001010",           // Wrapped MATIC token address on Polygon
    "ETH":      "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",           // Wrapped ETH token address on Polygon
    "BTC":      "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6"            // Wrapped BTC token address on Polygon
};

const supportedTokenAddresses = [];



// app.get('/blockNumber', async (req, res) => {
//     try {
//         const blockNumber = await web3.eth.getBlockNumber();
//         res.json({ blockNumber: blockNumber.toString() });  // Convert BigInt to string
//     } catch (error) {
//         console.error("Error fetching block number:", error);
//         res.status(500).json({ error: 'Failed to fetch block number' });
//     }
// });


app.get('/ubgtoken/balance/:address', async (req, res) => {
    try {
        const balance = await UBGToken.methods.balanceOf(req.params.address).call();
        res.json({ balance: balance.toString() });
    } catch (error) {
        console.error("Error fetching balance:", error);
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
});

app.post('/ubgtoken/burn', async(req, res) => {
    try {
        const userAddress = req.body.userAddress;
        // const tokenId = req.body.tokenId;
        const balanceToBurn = req.body.burnAmt;

        const txReceipt = await ubgTokenContractInteraction(UBGToken.methods.transfer("0xEdB61f74B0d09B2558F1eeb79B247c1F363Ae452", balanceToBurn).encodeABI());
        res.json({ success: true, transactionHash: txReceipt.transactionHash });
    }
    catch (error) {
        console.error("Error Burning UBG Token:", error);
        res.status(500).json({ error: "Failed to Burn UBG Token" });
    }
});



app.post('/escrow/setFee', async (req, res) => {
    const newFeePercentage = parseInt(req.body.feePercentage); // Assuming feePercentage is passed in request body

    if (isNaN(newFeePercentage)) {
        return res.status(400).json({ error: "Invalid fee percentage provided" });
    }

    try {
        // Call the setFee function to initiate the transaction
        const txReceipt = await escrowContractInteraction(Escrow.methods.setFeePercentage(newFeePercentage).encodeABI());
        res.json({ success: true, transactionHash: txReceipt.transactionHash });
    } catch (error) {
        console.error("Error setting fee:", error);
        res.status(500).json({ error: "Failed to set fee percentage" });
    }
});


app.post('/escrow/addSupportErc20', async (req, res) => {
    const tokenSymbol = req.body.tokenSymbol;
    if(!tokenSymbol) {
        return res.status(400).json({ error: "Invalid token symbol provided" });
    } 

    const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
    if(!tokenAddress) {
        return res.status(400).json({ error: "Invalid token symbol provided" });
    }

    try {
        const txReceipt = await escrowContractInteraction(Escrow.methods.addSupportedERC20(tokenAddress).encodeABI());

        if (!supportedTokenAddresses.includes(tokenAddress)) {
            supportedTokenAddresses.push(tokenAddress);
        }
        res.json({ success: true, transactionHash: txReceipt.transactionHash });
    } catch (error) {
        console.error("Error adding support for ERC 20:", error);
        res.status(500).json({ error: "Failed to add support for ERC 20 " + error });
    }
});


app.post('/escrow/removeSupportErc20', async (req, res) => {
    const tokenSymbol = req.body.tokenSymbol;
    if(!tokenSymbol) {
        return res.status(400).json({ error: "Invalid token symbol provided" });
    } 

    const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
    if(!tokenAddress) {
        return res.status(400).json({ error: "Invalid token symbol provided" });
    }

    try {
        const txReceipt = await escrowContractInteraction(Escrow.methods.removeSupportedERC20(tokenAddress).encodeABI());
        const index = supportedTokenAddresses.indexOf(tokenAddress);
        if (index !== -1) {
            supportedTokenAddresses.splice(index, 1);
        }
        res.json({ success: true, transactionHash: txReceipt.transactionHash });
    } catch (error) {
        console.error("Error adding support for ERC 20:", error);
        res.status(500).json({ error: "Failed to add support for ERC 20 " + error });
    }
});


app.post('/escrow/withdrawERC20', async (req, res) => {
    const tokenSymbol = req.body.tokenSymbol;
    if(!tokenSymbol) {
        return res.status(400).json({ error: "Invalid token symbol provided" });
    } 

    const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
    if(!tokenAddress) {
        return res.status(400).json({ error: "Invalid token symbol provided" });
    }

    const recipient = req.body.recipient;
    if(!recipient || !isValidAddress(recipient)) {
        return res.status(400).json({ error: "Invalid token Address provided" });
    }

    var amt = parseInt(req.body.amt);
    if(isNaN(amt)) {
        return res.status(400).json({ error: "Invalid amt provided" });
    }

    try {
        amt = web3.utils.toWei(amt, 'ether');
        const txReceipt = await escrowContractInteraction(Escrow.methods.withdrawERC20(recipient, tokenAddress, amt).encodeABI());
        res.json({ success: true, transactionHash: txReceipt.transactionHash });
    } catch (error) {
        console.error("Error while withdrawing ERC20:", error);
        res.status(500).json({ error: "Failed to withdraw ERC 20 " + error });
    }
});

app.post('/escrow/sweepERC20', async (req, res) => {

    let receipts = [];
    try {
        for(let i = 0; i < supportedTokenAddresses.length; i++) {
            let tokenAddress = supportedTokenAddresses[i];
            const txReceipt = await escrowContractInteraction(Escrow.methods.sweepERC20(tokenAddress).encodeABI());
            receipts.push(txReceipt);
        }
        res.json({ success: true, receipts: receipts });
    } catch (error) {
        console.error("Error while sweeping ERC20:", error);
        res.status(500).json({ error: "Failed to Sweep ERC 20 " + error });
    }
});

app.post('/escrow/withdrawERC1155', async (req, res) => {
    const tokenAddress = req.body.tokenSymbol;
    if(!tokenAddress) {
        return res.status(400).json({ error: "Invalid token symbol provided" });
    }

    const recipient = req.body.recipient;
    if(!recipient || !isValidAddress(recipient)) {
        return res.status(400).json({ error: "Invalid token address provided" });
    }

    const id = parseInt(req.body.id);
    if(isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID provided" });
    }

    var amt = parseInt(req.body.amt);
    if(isNaN(amt)) {
        return res.status(400).json({ error: "Invalid amt provided" });
    }

    try {
        amt = web3.utils.toWei(amt, 'ether');
        const txReceipt = await escrowContractInteraction(Escrow.methods.withdrawERC1155(recipient, tokenAddress, id, amt).encodeABI());
        res.json({ success: true, transactionHash: txReceipt.transactionHash });
    } catch (error) {
        console.error("Error while withdrawing ERC1155:", error);
        res.status(500).json({ error: "Failed to withdraw ERC1155 " + error });
    }
});





app.post('/ubg/finalizeGame', async (req, res) => {
    const add1 = req.body.player1;
    const add2 = req.body.player2;
    var betAmount = parseInt(req.body.betAmount);
    var winner = parseInt(req.body.winner);       //1 for address 1 and 2 for address 2

    if(!add1 || !isValidAddress(add1)) {
        return res.status(400).json({ error: "Invalid Address 1 provided" });
    } 

    if(!add2 || !isValidAddress(add2)) {
        return res.status(400).json({ error: "Invalid Address 2 provided" });
    } 

    if(isNaN(winner) || winner > 2 || winner < 1) {
        return res.status(400).json({ error: "Invalid Winner provided" });
    } 

    if(isNaN(betAmount)) {
        return res.status(400).json({ error: "Invalid betAmount provided" });
    }

    try {
        betAmount = web3.utils.toWei(betAmount, 'ether');
        winner = winner == 1 ? add1 : add2;
        const txReceipt = await unseenBattlegroundsContractInteraction(UnseenBattlegrounds.methods.finalizeGame(add1, add2, betAmount, winner).encodeABI());
        res.json({ success: true, transactionHash: txReceipt.transactionHash });
    } catch (error) {
        console.error("Error while finalising Game:", error);
        res.status(500).json({ error: "Failed to Finalise Game " + error });
    }
});



app.post('/assets/premine', async (req, res) => {
    try {
        const txReceipt = await ubgAssetsContractInteraction(UBGAssets.methods.premine().encodeABI());
        res.json({ success: true, transactionHash: txReceipt.transactionHash });
    } catch (error) {
        console.error("Error while premining assets:", error);
        res.status(500).json({ error: "Failed to Premine Assets " + error });
    }
});

app.post('/assets/seturi', async (req, res) => {
    //"https://myapi.com/api/token/{id}.json"
    const uri = req.body.uri;
    if(!uri) {
        return res.status(400).json({ error: "Invalid URI provided" });
    }

    try {
        const txReceipt = await ubgAssetsContractInteraction(UBGAssets.methods.seturi(uri).encodeABI());
        res.json({ success: true, transactionHash: txReceipt.transactionHash });
    } catch (error) {
        console.error("Error while settings URI:", error);
        res.status(500).json({ error: "Failed to set URI " + error });
    }
});


app.get('/assets/balance', async (req, res) => {
    try {
        const userAddress = req.query.userAddress;
        const tokenId = req.query.tokenId;

        const balance = await UBGAssets.methods.balanceOf(userAddress, tokenId).call();
        res.json({ balance: balance.toString() });
    } catch (error) {
        console.error("Error fetching balance:", error);
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
});

app.post('/assets/burn', async(req, res) => {
    try {
        const userAddress = req.body.userAddress;
        const tokenId = req.body.tokenId;
        const burnAmt = req.body.burnAmt;

        const txReceipt = await ubgAssetsContractInteraction(UBGAssets.methods.burn(userAddress, tokenId, burnAmt).encodeABI());
        res.json({ success: true, transactionHash: txReceipt.transactionHash });
    }
    catch (error) {
        console.error("Error Burning UBG Asset:", error);
        res.status(500).json({ error: "Failed to Burn UBG Asset" });
    }
});



async function ubgTokenContractInteraction (data) {
    return await contractInteraction(UBGToken.address, data);
}

async function ubgAssetsContractInteraction (data) {
    return await contractInteraction(UBGAssets.address, data);
}

async function escrowContractInteraction (data) {
    return await contractInteraction(EscrowData.address, data);
}

async function unseenBattlegroundsContractInteraction (data) {
    return await contractInteraction(UnseenBattlegroundsData.address, data);
}





async function contractInteraction (to, data) {
    try {
        const gasPrice = await web3.eth.getGasPrice();

        const txData = {
            to:         to,
            gas:        web3.utils.toHex(1000000),  // adjust this value based on your needs
            gasPrice:   gasPrice,
            data:       data,
            from:       ownerAccount
        };

        const txSigned  = await web3.eth.accounts.signTransaction(txData, privateKey);
        const txReceipt = await web3.eth.sendSignedTransaction(txSigned.rawTransaction);
        
        console.log('Transaction receipt:', txReceipt);
        return txReceipt;
    } 
    catch (error) {
        console.error("Error executing contract interaction :", error);
        throw error;
    }
}


function isValidAddress(address) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return false;
    }
    return web3.utils.isAddress(address);
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});



//Stuck because of execution reverted: ERC20: insufficient allowance
// app.post('/escrow/depositErc20', async (req, res) => {
//     const tokenSymbol = req.body.tokenSymbol;
//     if(!tokenSymbol) {
//         return res.status(400).json({ error: "Invalid token symbol provided" });
//     }

//     const amt = parseInt(req.body.amt);
//     if(isNaN(amt)) {
//         return res.status(400).json({ error: "Invalid amt provided" });
//     }

//     const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
//     if(!tokenAddress) {
//         return res.status(400).json({ error: "Invalid token symbol provided" });
//     }

//     try {
//         const txReceipt = await escrowContractInteraction(Escrow.methods.depositERC20(tokenAddress, amt).encodeABI());
//         res.json({ success: true, transactionHash: txReceipt.transactionHash });
//     } catch (error) {
//         console.error("Error depositing ERC 20:", error);
//         res.status(500).json({ error: "Failed to deposit ERC 20 " + error });
//     }
// });

// function depositERC1155(address tokenAddress, uint256 id, uint256 amount, bytes memory data) external {
//     IERC1155(tokenAddress).safeTransferFrom(msg.sender, address(this), id, amount, data);
//     emit ERC1155Deposited(msg.sender, tokenAddress, id, amount);
// }