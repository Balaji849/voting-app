// src/App.jsx (Final Version with Ethers.js)

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers'; // Import ethers
import contractInfo from './contractInfo.json'; // Import ABI and address
import './App.css';

// Get contract address and ABI from the imported JSON file
const CONTRACT_ADDRESS = contractInfo.address;
const CONTRACT_ABI = contractInfo.abi;

function App() {
  // States for provider, signer, contract instance
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);

  // Existing states
  const [account, setAccount] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false); // More specific loading later if needed
  const [error, setError] = useState('');
  const [networkName, setNetworkName] = useState(''); // Store network name

  // --- Core Blockchain Interaction Functions ---

  const connectWallet = useCallback(async () => {
    setError('');
    setLoading(true); // Start loading
    // Check if MetaMask (window.ethereum) is available
    if (window.ethereum) {
      try {
        // Request account access
        // Note: Ethers v6 recommends using provider.send("eth_requestAccounts", [])
        // but window.ethereum.request works broadly and is often simpler initially.
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          const currentAccount = accounts[0];
          setAccount(currentAccount);

          // Set up Ethers provider (connects to MetaMask)
          const web3Provider = new ethers.BrowserProvider(window.ethereum); // Ethers v6 uses BrowserProvider
          setProvider(web3Provider);

          // Get the signer (needed for transactions)
          const web3Signer = await web3Provider.getSigner(); // Use await for getSigner in v6
          setSigner(web3Signer);

          // Get network info
          const network = await web3Provider.getNetwork();
          // BigInt comparison in Ethers v6
          setNetworkName(network.chainId === 31337n ? 'Localhost/Hardhat' : network.name); // Handle local network

          console.log("Wallet connected:", currentAccount);
          console.log("Network:", network.name, "(Chain ID:", network.chainId.toString() + ")"); // Use toString for BigInt

        } else {
          setError("No accounts found. Please unlock or create an account in MetaMask.");
        }
      } catch (err) {
        console.error("Error connecting wallet:", err);
        if (err.code === 4001) { // User rejected connection
          setError("Connection rejected. Please connect your wallet.");
        } else {
          setError(`Connection error: ${err.message}`);
        }
        setAccount(null); // Reset account state on error
      } finally {
          setLoading(false); // Stop loading regardless of outcome
      }
    } else {
      setError('MetaMask not detected. Please install MetaMask!');
      setLoading(false);
    }
  }, []); // Empty dependency array: function doesn't depend on props/state

  // Function to load data from the smart contract
  const loadContractData = useCallback(async () => {
    if (!contract || !account) {
       console.log("Contract instance or account not available yet.");
       return;
    }

    console.log("Loading contract data...");
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Proposals
      const count = await contract.getProposalsCount(); // Returns BigInt in ethers v6
      const proposalsArray = [];
      // Loop based on the count (convert BigInt to number for loop)
      for (let i = 0; i < Number(count); i++) {
        // Call the contract's getProposal function
        const [name, voteCount] = await contract.getProposal(i);
        proposalsArray.push({
          index: i,
          name: name,
          voteCount: Number(voteCount), // Convert BigInt voteCount to number
        });
      }
      setProposals(proposalsArray);
      console.log("Proposals loaded:", proposalsArray);

      // 2. Check if the connected account has already voted
      const votedStatus = await contract.hasVoted(account);
      setHasVoted(votedStatus);
      console.log(`Account ${account} has voted: ${votedStatus}`);

    } catch (err) {
      console.error("Error loading contract data:", err);
      if (err.message.includes("contract not found") || err.code === 'CALL_EXCEPTION') {
           setError(`Failed to load data. Ensure you are on the correct network (${networkName || 'checking...'}) and the contract address (${CONTRACT_ADDRESS}) is correct.`);
      } else {
           setError(`Error loading data: ${err.message}. Check console.`);
      }
      setProposals([]);
      setHasVoted(false);
    } finally {
      setLoading(false);
    }
  }, [contract, account, networkName]); // Dependencies: reload if contract, account, or network changes

  // Function to handle casting a vote (sends a transaction)
  const handleVote = async (proposalIndex) => {
    if (!contract || !signer || hasVoted) {
      setError(hasVoted ? "You have already voted." : "Connect wallet and ensure contract is loaded.");
      return;
    }

    console.log(`Attempting to vote for proposal index: ${proposalIndex}`);
    setLoading(true);
    setError('');

    try {
      // IMPORTANT: To send a transaction, connect the contract instance to the signer
      // In ethers v6, contract instances are usually immutable, connect signer during call or get new instance
      const tx = await contract.connect(signer).vote(proposalIndex); // Use connect(signer) before calling write method

      console.log("Transaction sent:", tx.hash);
      // Wait for the transaction to be mined (confirmed on the blockchain)
      const receipt = await tx.wait(); // wait() returns the transaction receipt
      console.log("Transaction confirmed! Receipt:", receipt);

      // Refresh data after successful vote
      setHasVoted(true);
      await loadContractData();

    } catch (err) {
      console.error("Voting failed:", err);
      if (err.code === 'ACTION_REJECTED') {
        setError("Transaction rejected in wallet.");
      } else if (err?.reason) { // Check for revert reason
        setError(`Voting Error: ${err.reason}`);
      } else if (err?.data?.message) { // Another place revert reasons might show up
         setError(`Voting Error: ${err.data.message}`)
      } else {
        setError(`Voting failed: ${err.message}. Check console.`);
      }
      // Optional: Refresh data even on failure
      await loadContractData();
    } finally {
      setLoading(false);
    }
  };

  // --- useEffect Hooks for Lifecycle Management ---

  // Effect 1: Create contract instance when provider/signer are ready
  useEffect(() => {
    if (provider && CONTRACT_ADDRESS !== "YOUR_CONTRACT_ADDRESS_HERE" && ethers.isAddress(CONTRACT_ADDRESS)) { // Check if valid address
      try {
        // Use the provider for read-only instance, connect signer for writes later
        const contractInstance = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          provider
        );
        setContract(contractInstance);
        console.log("Contract instance created");
      } catch (err) {
         console.error("Error creating contract instance:", err);
         setError(`Failed to create contract instance. Is the ABI correct and address ${CONTRACT_ADDRESS} valid?`);
      }
    } else {
       setContract(null);
       if(CONTRACT_ADDRESS === "YOUR_CONTRACT_ADDRESS_HERE" || !ethers.isAddress(CONTRACT_ADDRESS)) {
           setError("Contract address not set or invalid in src/contractInfo.json. Deploy your contract first.");
       }
    }
    // Adding CONTRACT_ABI and CONTRACT_ADDRESS as dependencies ensures recreation if they somehow change,
    // though they usually don't after initial load. Provider is the main trigger.
  }, [provider, CONTRACT_ADDRESS, CONTRACT_ABI]);

  // Effect 2: Load contract data when the contract instance or account is ready/changes
  useEffect(() => {
    if (contract && account) {
       console.log("Contract and account ready, loading initial data...");
       loadContractData();
    } else {
       setProposals([]);
       setHasVoted(false);
    }
  }, [contract, account, loadContractData]); // loadContractData is memoized by useCallback

   // Effect 3: Set up listeners for MetaMask events (account/network changes)
   useEffect(() => {
       const eth = window.ethereum;
       if (eth) {
           const handleAccountsChanged = async (accounts) => { // Make async for getSigner
               console.log("Accounts changed:", accounts);
               if (accounts.length > 0) {
                   setAccount(accounts[0]);
                   // Re-initialize provider/signer for the new account using Ethers v6 pattern
                   const web3Provider = new ethers.BrowserProvider(eth);
                   setProvider(web3Provider);
                   const web3Signer = await web3Provider.getSigner(); // Need await
                   setSigner(web3Signer);
               } else {
                   console.log("Wallet disconnected");
                   setAccount(null);
                   setSigner(null);
                   setProvider(null);
                   setContract(null);
                   setError("Wallet disconnected. Please connect.");
               }
           };

           const handleChainChanged = (_chainId) => {
               console.log("Network chain changed:", _chainId);
               setError("Network changed. Please reload the page and reconnect.");
               // Force reload for simplicity to ensure correct network context
               window.location.reload();
           };

           // Subscribe to events
           eth.on('accountsChanged', handleAccountsChanged);
           eth.on('chainChanged', handleChainChanged);

           // Cleanup function
           return () => {
               // Check if removeListener exists before calling
               if (eth.removeListener) {
                   eth.removeListener('accountsChanged', handleAccountsChanged);
                   eth.removeListener('chainChanged', handleChainChanged);
               }
           };
       }
   }, []); // Run only once on component mount


  // --- Render Logic ---
  return (
    <div className="App">
      <header className="App-header">
        <h1>Decentralized Voting</h1>
        {account ? (
          <div>
             <p>Connected: <span className="account-address">{account.substring(0, 6)}...{account.substring(account.length - 4)}</span></p>
             <p>Network: {networkName || 'Loading...'}</p>
          </div>
        ) : (
          <button onClick={connectWallet} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </header>

      {error && <p className="error-message">{error}</p>}

      <main className="App-main">
        <h2>Candidates</h2>
        {loading && account && <p>Loading / Processing...</p>} {/* Show loading only if connected */}

        {account && !loading && proposals.length === 0 && <p>No proposals found or unable to load.</p>}

        {account && !loading && proposals.length > 0 && (
          <ul className="proposals-list">
            {proposals.map((proposal) => (
              <li key={proposal.index}>
                <span>{proposal.name} ({proposal.voteCount} votes)</span>
                {!hasVoted && (
                   <button
                     onClick={() => handleVote(proposal.index)}
                     disabled={loading}
                     className="vote-button"
                   >
                     Vote
                   </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {account && !loading && hasVoted && <p className="voted-message">You have already cast your vote on this network.</p>}
        {!account && !loading && <p className='info-message'>Connect your wallet to view proposals and vote.</p>}

         {account && contract &&
            <button className='refresh-button' onClick={loadContractData} disabled={loading} style={{marginTop: '20px', }}>
                {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
         }
      </main>
    </div>
  );
}

export default App;