import { Keyring } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { expect } from "chai";
import Web3 from "web3";
import { Account } from "web3-core";
import { formatBalance } from "@polkadot/util";
import type { SubmittableExtrinsic } from "@polkadot/api/promise/types";
import { blake2AsHex } from "@polkadot/util-crypto";

import {
  GENESIS_ACCOUNT,
  GENESIS_ACCOUNT_BALANCE,
  GENESIS_ACCOUNT_PRIVATE_KEY,
  GLMR,
  ALITH_PRIV_KEY,
  ALITH,
  VOTE_AMOUNT
} from "../util/constants";
import { describeDevMoonbeam } from "../util/setup-dev-tests";
const relayChainAddress: string =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const relayChainAddress_2: string =
  "0x2222222222222222222222222222222222222222222222222222222222222222";

// 5 blocks per minute, 4 weeks
const vesting = 201600;
async function calculate_vested_amount(context, totalReward, initialPayment, numberOfBlocks) {
  let amountToVest = BigInt(totalReward) - BigInt(initialPayment);
  let vestedPerBlock = amountToVest / BigInt(vesting);

  // On average a parachain only gets a candidate into every other relay chain block.
  // In the dev service, where the relay block number is mocked, we get exactly two relay blocks.
  let elapsedRelayBlocks = numberOfBlocks * 2;
  let shouldHaveVested = BigInt(initialPayment) + vestedPerBlock * BigInt(elapsedRelayBlocks);
  let claimedAsBalance = formatBalance(shouldHaveVested, { withSi: true, withUnit: "UNIT" }, 18);
  return claimedAsBalance;
}

describeDevMoonbeam("Crowdloan", (context) => {
  let genesisAccount: KeyringPair, sudoAccount: KeyringPair;

  before("Setup genesis account for substrate", async () => {
    const keyring = new Keyring({ type: "ethereum" });
    genesisAccount = await keyring.addFromUri(GENESIS_ACCOUNT_PRIVATE_KEY, null, "ethereum");
    sudoAccount = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");
  });
  it.skip("should check initial state", async function () {
    // check that genesis has genesis balance
    expect(Number(await context.web3.eth.getBalance(GENESIS_ACCOUNT))).to.eq(
      Number(GENESIS_ACCOUNT_BALANCE)
    );
    // check that genesis is not registered
    const isPayable = await context.polkadotApi.query.crowdloanRewards.accountsPayable(
      GENESIS_ACCOUNT
    );
    expect(isPayable.toHuman()).to.equal(null);
  });
  it.skip("should be able to register the genesis account for reward", async function () {
    // should be able to register the genesis account for reward
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.initializeRewardVec([
          [relayChainAddress, GENESIS_ACCOUNT, 3_000_000n * GLMR],
        ])
      )
      .signAndSend(sudoAccount);
    await context.createBlock();

    let initBlock = (await context.polkadotApi.query.crowdloanRewards.initRelayBlock()) as any;

    // Complete initialization
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.completeInitialization(Number(initBlock) + vesting)
      )
      .signAndSend(sudoAccount);
    await context.createBlock();

    expect(
      (
        (
          await context.polkadotApi.query.crowdloanRewards.accountsPayable(GENESIS_ACCOUNT)
        ).toHuman() as any
      ).total_reward
    ).to.equal("3.0000 MUNIT");
    let isInitialized = await context.polkadotApi.query.crowdloanRewards.initialized();
    expect(isInitialized.toHuman()).to.be.true;
  });
});

describeDevMoonbeam("Crowdloan", (context) => {
  let genesisAccount: KeyringPair, sudoAccount: KeyringPair;

  before("Setup genesis account for substrate", async () => {
    const keyring = new Keyring({ type: "ethereum" });
    genesisAccount = await keyring.addFromUri(GENESIS_ACCOUNT_PRIVATE_KEY, null, "ethereum");
    sudoAccount = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");
  });
  it.skip("should be able to make a first claim", async function () {
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.initializeRewardVec([
          [relayChainAddress, GENESIS_ACCOUNT, 3_000_000n * GLMR],
        ])
      )
      .signAndSend(sudoAccount);
    await context.createBlock();

    let initBlock = (await context.polkadotApi.query.crowdloanRewards.initRelayBlock()) as any;

    // Complete initialization
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.completeInitialization(Number(initBlock) + vesting)
      )
      .signAndSend(sudoAccount);
    await context.createBlock();

    let rewardInfo = (
      await context.polkadotApi.query.crowdloanRewards.accountsPayable(GENESIS_ACCOUNT)
    ).toJSON() as any;
    let claimed = await calculate_vested_amount(
      context,
      rewardInfo.total_reward,
      rewardInfo.claimed_reward,
      2
    );
    // construct a transaction
    const transfer = context.polkadotApi.tx.crowdloanRewards.claim();
    await transfer.signAndSend(genesisAccount);

    await context.createBlock();

    expect(
      (
        (
          await context.polkadotApi.query.crowdloanRewards.accountsPayable(GENESIS_ACCOUNT)
        ).toHuman() as any
      ).claimed_reward
    ).to.equal(claimed);

    // check balances
    expect(
      formatBalance(
        BigInt(await context.web3.eth.getBalance(GENESIS_ACCOUNT)) - GENESIS_ACCOUNT_BALANCE,
        { withSi: true, withUnit: "UNIT" },
        18
      )
    ).to.equal(claimed);
    const account = await context.polkadotApi.query.system.account(GENESIS_ACCOUNT);
    expect(
      formatBalance(
        account.data.free.toBigInt() - GENESIS_ACCOUNT_BALANCE,
        { withSi: true, withUnit: "UNIT" },
        18
      )
    ).to.equal(claimed);
  });
});

describeDevMoonbeam("Crowdloan", (context) => {
  let genesisAccount: KeyringPair, sudoAccount: KeyringPair;

  before("Setup genesis account for substrate", async () => {
    const keyring = new Keyring({ type: "ethereum" });
    genesisAccount = await keyring.addFromUri(GENESIS_ACCOUNT_PRIVATE_KEY, null, "ethereum");
    sudoAccount = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");
  });
  it.skip("should show the money after 5 blocks, after first claim was called", async function () {
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.initializeRewardVec([
          [relayChainAddress, GENESIS_ACCOUNT, 3_000_000n * GLMR],
        ])
      )
      .signAndSend(sudoAccount);
    await context.createBlock();

    let initBlock = (await context.polkadotApi.query.crowdloanRewards.initRelayBlock()) as any;

    // Complete initialization
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.completeInitialization(Number(initBlock) + vesting)
      )
      .signAndSend(sudoAccount);
    await context.createBlock();

    let rewardInfo = (
      await context.polkadotApi.query.crowdloanRewards.accountsPayable(GENESIS_ACCOUNT)
    ).toJSON() as any;

    // construct a transaction
    const transfer = context.polkadotApi.tx.crowdloanRewards.claim();
    await transfer.signAndSend(genesisAccount);

    await context.createBlock();

    // should show me the money after 5 blocks
    await context.createBlock();
    await context.createBlock();

    let claimed = await calculate_vested_amount(
      context,
      rewardInfo.total_reward,
      rewardInfo.claimed_reward,
      5
    );

    await context.polkadotApi.tx.crowdloanRewards.claim().signAndSend(genesisAccount);
    await context.createBlock();
    const isPayable4 = await context.polkadotApi.query.crowdloanRewards.accountsPayable(
      GENESIS_ACCOUNT
    );
    expect((isPayable4.toHuman() as any).claimed_reward).to.equal(claimed);
  });
});

describeDevMoonbeam("Crowdloan", (context) => {
  let genesisAccount: KeyringPair, sudoAccount: KeyringPair;

  before("Setup genesis account for substrate", async () => {
    const keyring = new Keyring({ type: "ethereum" });
    genesisAccount = await keyring.addFromUri(GENESIS_ACCOUNT_PRIVATE_KEY, null, "ethereum");
    sudoAccount = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");
  });
  it.skip("should make first claim 5 blocks after initialization called", async function () {
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.initializeRewardVec([
          [relayChainAddress, GENESIS_ACCOUNT, 3_000_000n * GLMR],
        ])
      )
      .signAndSend(sudoAccount);
    await context.createBlock();

    let initBlock = (await context.polkadotApi.query.crowdloanRewards.initRelayBlock()) as any;

    // Complete initialization
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.completeInitialization(Number(initBlock) + vesting)
      )
      .signAndSend(sudoAccount);
    await context.createBlock();

    let rewardInfo = (
      await context.polkadotApi.query.crowdloanRewards.accountsPayable(GENESIS_ACCOUNT)
    ).toJSON() as any;
    await context.createBlock();

    // should show me the money after 5 blocks
    await context.createBlock();
    await context.createBlock();
    let claimed = await calculate_vested_amount(
      context,
      rewardInfo.total_reward,
      rewardInfo.claimed_reward,
      5
    );

    await context.polkadotApi.tx.crowdloanRewards.claim().signAndSend(genesisAccount);
    await context.createBlock();

    const isPayable4 = await context.polkadotApi.query.crowdloanRewards.accountsPayable(
      GENESIS_ACCOUNT
    );
    expect((isPayable4.toHuman() as any).claimed_reward).to.equal(claimed);
  });
});

describeDevMoonbeam("Crowdloan", (context) => {
  let genesisAccount: KeyringPair, sudoAccount: KeyringPair;

  before("Setup genesis account for substrate", async () => {
    const keyring = new Keyring({ type: "ethereum" });
    genesisAccount = await keyring.addFromUri(GENESIS_ACCOUNT_PRIVATE_KEY, null, "ethereum");
    sudoAccount = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");
  });
  it.skip("should not be able to call initializeRewardVec another time", async function () {
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.initializeRewardVec([
          [relayChainAddress, GENESIS_ACCOUNT, 3_000_000n * GLMR],
        ])
      )
      .signAndSend(sudoAccount);
    await context.createBlock();

    let initBlock = (await context.polkadotApi.query.crowdloanRewards.initRelayBlock()) as any;

    // Complete initialization
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.completeInitialization(Number(initBlock) + vesting)
      )
      .signAndSend(sudoAccount);
    await context.createBlock();

    // should not be able to call initializeRewardVec another time
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.initializeRewardVec([
          [relayChainAddress, ALITH, 1000n * GLMR],
        ])
      )
      .signAndSend(genesisAccount);
    await context.createBlock();
    expect(
      (await context.polkadotApi.query.crowdloanRewards.accountsPayable(ALITH)).toHuman() as any
    ).to.equal(null);
  });
});

describeDevMoonbeam("Crowdloan", (context) => {
  let genesisAccount: KeyringPair;
  let alithAccount: KeyringPair;

  before("Setup genesis account for substrate", async () => {
    const keyring = new Keyring({ type: "ethereum" });
    genesisAccount = await keyring.addFromUri(GENESIS_ACCOUNT_PRIVATE_KEY, null, "ethereum");
    alithAccount = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");
  });

  it.skip("should be able to register the genesis account - with small amount", async function () {
    // initializeRewardVec
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.initializeRewardVec([
          [relayChainAddress, ALITH, 3_000_000n * GLMR],
        ])
      )
      .signAndSend(alithAccount);
    await context.createBlock();

    let initBlock = (await context.polkadotApi.query.crowdloanRewards.initRelayBlock()) as any;

    // Complete initialization
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.completeInitialization(Number(initBlock) + vesting)
      )
      .signAndSend(alithAccount);
    await context.createBlock();

    expect(
      ((await context.polkadotApi.query.crowdloanRewards.accountsPayable(ALITH)).toHuman() as any)
        .total_reward
    ).to.equal("3.0000 MUNIT");

    let rewardInfo = (
      await context.polkadotApi.query.crowdloanRewards.accountsPayable(ALITH)
    ).toJSON() as any;
    let claimed = await calculate_vested_amount(
      context,
      rewardInfo.total_reward,
      rewardInfo.claimed_reward,
      2
    );
    // claim
    await context.polkadotApi.tx.crowdloanRewards.claim().signAndSend(alithAccount);
    await context.createBlock();

    const isPayable4 = await context.polkadotApi.query.crowdloanRewards.accountsPayable(ALITH);
    expect((isPayable4.toHuman() as any).claimed_reward).to.equal(claimed);
  });
});

describeDevMoonbeam("Crowdloan", (context) => {
  let genesisAccount: KeyringPair, sudoAccount: KeyringPair;

  let numberOfAccounts: number = 1000; // min 2
  let largInput: [string, string, bigint][];

  before("Setup genesis account for substrate", async () => {
    numberOfAccounts = Number(
      (await context.polkadotApi.consts.crowdloanRewards.maxInitContributors) as any
    );
    const keyring = new Keyring({ type: "ethereum" });
    genesisAccount = await keyring.addFromUri(GENESIS_ACCOUNT_PRIVATE_KEY, null, "ethereum");
    sudoAccount = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");
  });

  it.skip("should be able to register many accounts : " + numberOfAccounts, async function () {
    // should create a bunch of test eth accounts
    this.timeout(30000);
    let web3 = new Web3();
    // We need to make sure the rewards match the account funds. 3M GLMR/ number of accounts
    let accounts = new Array(numberOfAccounts).fill(0).map((_) => web3.eth.accounts.create());
    largInput = accounts.map((acc: Account, i: number) => {
      return [
        acc.address + "111111111111111111111111",
        acc.address,
        (3_000_000n * GLMR) / BigInt(numberOfAccounts),
      ];
    });
    expect(largInput.length).to.eq(numberOfAccounts);
    expect(largInput[0][1] !== largInput[numberOfAccounts - 1][1]).to.eq(true);

    // should be able to register many accounts
    await context.polkadotApi.tx.sudo
      .sudo(context.polkadotApi.tx.crowdloanRewards.initializeRewardVec(largInput))
      .signAndSend(sudoAccount);

    await context.createBlock();

    let initBlock = (await context.polkadotApi.query.crowdloanRewards.initRelayBlock()) as any;

    // Complete initialization
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.completeInitialization(Number(initBlock) + vesting)
      )
      .signAndSend(sudoAccount);
    await context.createBlock();

    const rewardPerContributor = formatBalance(
      (3_000_000n * GLMR) / BigInt(numberOfAccounts),
      { withSi: true, withUnit: "UNIT" },
      18
    );

    await Promise.all(
      largInput.map(async (input) => {
        expect(
          (
            (
              await context.polkadotApi.query.crowdloanRewards.accountsPayable(input[1])
            ).toHuman() as any
          ).total_reward
        ).to.equal(rewardPerContributor);
      })
    );
  });
});

describeDevMoonbeam("Crowdloan", (context) => {
  let genesisAccount: KeyringPair, sudoAccount: KeyringPair;

  let numberOfAccounts: number = 1000; // min 2
  let largInput: [string, string, bigint][];

  before("Setup genesis account for substrate", async () => {
    // We shouldnt be able to register as many accounts unless we do it in batches
    numberOfAccounts = Number(
      (await context.polkadotApi.consts.crowdloanRewards.maxInitContributors) as any
    );
    const keyring = new Keyring({ type: "ethereum" });
    genesisAccount = await keyring.addFromUri(GENESIS_ACCOUNT_PRIVATE_KEY, null, "ethereum");
    sudoAccount = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");
  });

  it.skip(
    "should be able to register many accounts - batch : " + numberOfAccounts,
    async function () {
      // should create a bunch of test eth accounts
      this.timeout(20000);
      let web3 = new Web3();
      let accounts = new Array(numberOfAccounts).fill(0).map((_, i) => web3.eth.accounts.create());
      largInput = accounts.map((acc: Account, i: number) => {
        return [
          acc.address + "111111111111111111111111",
          acc.address,
          (3_000_000n * GLMR) / BigInt(numberOfAccounts),
        ];
      });
      expect(largInput.length).to.eq(numberOfAccounts);
      expect(largInput[0][1] !== largInput[numberOfAccounts - 1][1]).to.eq(true);

      // should be able to register many accounts
      await context.polkadotApi.tx.utility
        .batch([
          await context.polkadotApi.tx.sudo.sudo(
            context.polkadotApi.tx.crowdloanRewards.initializeRewardVec(
              largInput.slice(0, Math.floor(numberOfAccounts / 3))
            )
          ),
          await context.polkadotApi.tx.sudo.sudo(
            context.polkadotApi.tx.crowdloanRewards.initializeRewardVec(
              largInput.slice(
                Math.floor(numberOfAccounts / 3),
                Math.floor((numberOfAccounts * 2) / 3)
              )
            )
          ),
          await context.polkadotApi.tx.sudo.sudo(
            context.polkadotApi.tx.crowdloanRewards.initializeRewardVec(
              largInput.slice(Math.floor((numberOfAccounts * 2) / 3), numberOfAccounts)
            )
          ),
        ])
        .signAndSend(sudoAccount);
      await context.createBlock();

      let initBlock = (await context.polkadotApi.query.crowdloanRewards.initRelayBlock()) as any;

      // Complete initialization
      await context.polkadotApi.tx.sudo
        .sudo(
          context.polkadotApi.tx.crowdloanRewards.completeInitialization(
            Number(initBlock) + vesting
          )
        )
        .signAndSend(sudoAccount);
      await context.createBlock();

      const rewardPerContributor = formatBalance(
        (3_000_000n * GLMR) / BigInt(numberOfAccounts),
        { withSi: true, withUnit: "UNIT" },
        18
      );

      await Promise.all(
        largInput.map(async (input) => {
          expect(
            (
              (
                await context.polkadotApi.query.crowdloanRewards.accountsPayable(input[1])
              ).toHuman() as any
            ).total_reward
          ).to.equal(rewardPerContributor);
        })
      );
    }
  );
});

describeDevMoonbeam("Crowdloan", (context) => {
  let genesisAccount: KeyringPair, sudoAccount: KeyringPair;

  before("Setup genesis account for substrate", async () => {
    const keyring = new Keyring({ type: "ethereum" });
    genesisAccount = await keyring.addFromUri(GENESIS_ACCOUNT_PRIVATE_KEY, null, "ethereum");
    sudoAccount = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");
  });
  it("should be able to initialize through democracy", async function () {
    this.timeout(1_000_000);
    let calls = [];
    // We are gonna put the initialization and completion in a batch_all utility call
    calls.push(
      context.polkadotApi.tx.crowdloanRewards.initializeRewardVec([
        [relayChainAddress, GENESIS_ACCOUNT, 1_500_000n * GLMR],
        [relayChainAddress_2, null, 1_500_000n * GLMR],
      ])
    );

    let initBlock = (await context.polkadotApi.query.crowdloanRewards.initRelayBlock()) as any;
    calls.push(
      context.polkadotApi.tx.crowdloanRewards.completeInitialization(Number(initBlock) + vesting)
    );

    // Here we build the utility call
    const proposal = context.polkadotApi.tx.utility.batchAll(calls);

    // We encode the proposal
    let encodedProposal = (proposal as SubmittableExtrinsic)?.method.toHex() || "";
    let encodedHash = blake2AsHex(encodedProposal);

    // Submit the pre-image
    await context.polkadotApi.tx.democracy.notePreimage(encodedProposal).signAndSend(sudoAccount);

    await context.createBlock();

    // Propose
    await context.polkadotApi.tx.democracy
      .propose(encodedHash, 1000n * GLMR)
      .signAndSend(sudoAccount);

    await context.createBlock();
    const publicPropCount = await context.polkadotApi.query.democracy.publicPropCount();

    /// Wait launchPeriod elapsed
    let launchPeriod = await context.polkadotApi.consts.democracy.launchPeriod;
    for (let i = 0; i < Number(launchPeriod); i++) {
      await context.createBlock();
    
    }
    // genesis account vote
    await context.polkadotApi.tx.democracy.vote(0, {
      Standard: { balance: VOTE_AMOUNT, vote: { aye: true, conviction: 1 } },
    }).signAndSend(sudoAccount);

    await context.createBlock();

    const referendumInfoOf = await context.polkadotApi.query.democracy.referendumInfoOf(0);
    expect((referendumInfoOf.toHuman() as any).Ongoing.proposalHash).to.equal(encodedHash);
    expect((referendumInfoOf.toHuman() as any).Ongoing.tally.ayes).to.equal("10.0000 UNIT");
    expect((referendumInfoOf.toHuman() as any).Ongoing.tally.turnout).to.equal("10.0000 UNIT");

    // Verify that one referundum is triggered
    let referendumCount = await context.polkadotApi.query.democracy.referendumCount();
    expect(referendumCount.toHuman()).to.equal("1");
 
    /// Wait launchPeriod elapsed
    let enactmentPeriod = await context.polkadotApi.consts.democracy.enactmentPeriod;

    let votingPeriod = await context.polkadotApi.consts.democracy.votingPeriod;
    /// Wait launchPeriod elapsed
    for (let i = 0; i < (Number(enactmentPeriod) + Number(votingPeriod)); i++) {
      await context.createBlock();
    }

    const block = await context.web3.eth.getBlock("latest");
    console.log(enactmentPeriod)
    console.log(votingPeriod)
    console.log(block.number)
    const referendumInfoOf_2 = await context.polkadotApi.query.democracy.referendumInfoOf(0);

    console.log(referendumInfoOf.toHuman() as any)

    await context.createBlock();

    let isInitialized = await context.polkadotApi.query.crowdloanRewards.initialized();

    expect(isInitialized.toHuman()).to.be.true;

    // Get reward info of associated
    let reward_info_associated = (
      await context.polkadotApi.query.crowdloanRewards.accountsPayable(GENESIS_ACCOUNT)
    ).toHuman() as any;

    // Get reward info of unassociated
    let reward_info_unassociated = (
      await context.polkadotApi.query.crowdloanRewards.unassociatedContributions(
        relayChainAddress_2
      )
    ).toHuman() as any;

    // Check payments
    expect(reward_info_associated.total_reward).to.equal("1.5000 MUNIT");

    expect(reward_info_associated.claimed_reward).to.equal("450.0000 kUNIT");

    expect(reward_info_unassociated.total_reward).to.equal("1.5000 MUNIT");

    expect(reward_info_unassociated.claimed_reward).to.equal("0");

    // check balances
    const account = await context.polkadotApi.query.system.account(GENESIS_ACCOUNT);
    expect(
      formatBalance(
        account.data.free.toBigInt() - GENESIS_ACCOUNT_BALANCE,
        { withSi: true, withUnit: "UNIT" },
        18
      )
    ).to.equal(reward_info_associated.claimed_reward);
  });
});

describeDevMoonbeam("Crowdloan", (context) => {
  let genesisAccount: KeyringPair, sudoAccount: KeyringPair;

  before("Setup genesis account for substrate", async () => {
    const keyring = new Keyring({ type: "ethereum" });
    genesisAccount = await keyring.addFromUri(GENESIS_ACCOUNT_PRIVATE_KEY, null, "ethereum");
    sudoAccount = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");
  });
  it.skip("should be able to burn the dust", async function () {
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.initializeRewardVec([
          [relayChainAddress, GENESIS_ACCOUNT, 1_500_000n * GLMR],
          [relayChainAddress_2, null, 1_499_999_999_999_999_999_999_999n],
        ])
      )
      .signAndSend(sudoAccount);
    await context.createBlock();

    let initBlock = (await context.polkadotApi.query.crowdloanRewards.initRelayBlock()) as any;
    let previousIssuance = (await context.polkadotApi.query.balances.totalIssuance()) as any;

    // Complete initialization
    await context.polkadotApi.tx.sudo
      .sudo(
        context.polkadotApi.tx.crowdloanRewards.completeInitialization(Number(initBlock) + vesting)
      )
      .signAndSend(sudoAccount);
    await context.createBlock();

    let issuance = (await context.polkadotApi.query.balances.totalIssuance()) as any;

    let isInitialized = await context.polkadotApi.query.crowdloanRewards.initialized();

    expect(isInitialized.toHuman()).to.be.true;

    // We should have burnt 1
    expect(issuance.toString()).to.eq((BigInt(previousIssuance) - BigInt(1)).toString());
  });
});