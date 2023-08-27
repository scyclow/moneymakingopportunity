// async function main() {
//   const [artist, collector1, collector2, collector3] = await ethers.getSigners()
//   console.log('Deploying base contract for artist addr:', artist.address)

//   MoneyMakingOpportunityFactory = await ethers.getContractFactory('MoneyMakingOpportunity', artist)
//   MoneyMakingOpportunity = await MoneyMakingOpportunityFactory.deploy()
//   await MoneyMakingOpportunity.deployed()


//   console.log(`MoneyMakingOpportunity:`, MoneyMakingOpportunity.address)
// }

async function main() {
  const [artist, collector1, collector2, collector3] = await ethers.getSigners()
  console.log('Deploying base contract for artist addr:', artist.address)

  const MMOProp15Factory = await ethers.getContractFactory('MMOProp15', artist)
  MMOProp15 = await MMOProp15Factory.deploy()
  await MMOProp15.deployed()

  console.log(`MMOProp15:`, MMOProp15.address)
  console.log(`MMOProp15 White Paper:`, await MMOProp15.whitePaper())

}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });