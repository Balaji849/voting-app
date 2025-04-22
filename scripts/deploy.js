// scripts/deploy.js (Corrected for Ethers v6 / Hardhat 2.x)

const hre = require("hardhat");
const fs = require('fs'); // Node.js file system module for writing files

async function main() {
  console.log("Deploying Voting contract...");

  // Get the contract factory using the name of the contract in your .sol file
  const VotingContract = await hre.ethers.getContractFactory("Voting");

  // Start the deployment process. In ethers v6, deploy() returns a promise that resolves to the Contract instance.
  const voting = await VotingContract.deploy(); // Add constructor arguments here if needed

  // --- Ethers v6 change: Use waitForDeployment() ---
  // Wait for the deployment transaction to be mined and the contract fully deployed.
  console.log("Waiting for contract deployment to complete...");
  await voting.waitForDeployment();
  // --- End Ethers v6 change ---

  // --- Ethers v6 change: Use getAddress() ---
  const contractAddress = await voting.getAddress();
  // --- End Ethers v6 change ---

  // Log the address the contract was deployed to
  console.log(`Voting contract deployed successfully to: ${contractAddress}`);


  // --- Export Contract Address and ABI for Frontend ---
  console.log("Exporting contract address and ABI...");

  // Read the artifact file generated during compilation (contains ABI)
  const contractArtifact = await hre.artifacts.readArtifact("Voting");

  // Prepare the data object to save
  const exportData = {
    address: contractAddress, // Use the address obtained via getAddress()
    abi: contractArtifact.abi // The ABI from the artifact
  };

  // Define the path to the frontend source directory
  const frontendSrcDir = __dirname + '/../voting-app-frontend/src';

  // Check if the frontend directory exists, create it if not
  if (!fs.existsSync(frontendSrcDir)){
      console.log(`Frontend directory ${frontendSrcDir} not found, creating it.`);
      fs.mkdirSync(frontendSrcDir, { recursive: true });
  }

  // Write the address and ABI to a JSON file in the frontend's src folder
  const outputPath = frontendSrcDir + '/contractInfo.json';
  fs.writeFileSync(
    outputPath,
    JSON.stringify(exportData, null, 2) // Convert data to JSON string (pretty-printed)
  );

  console.log(`Contract address and ABI exported to ${outputPath}`);
  console.log("Deployment and export complete!");
  // --- End Export ---
}

// Standard Hardhat pattern to run main and catch errors
main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1; // Exit with a non-zero code to indicate failure
});