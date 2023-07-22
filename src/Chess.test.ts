import ChessZkApp, { ChessBoard } from './Chess';
import { Mina, PrivateKey, PublicKey, AccountUpdate, UInt32 } from 'snarkyjs';

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

let proofsEnabled = false;

describe('Chess', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: ChessZkApp;

  beforeAll(async () => {
    if (proofsEnabled) await ChessZkApp.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    ({ privateKey: senderKey, publicKey: senderAccount } =
      Local.testAccounts[1]);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new ChessZkApp(zkAppAddress);
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  it('generates and deploys the `ChessZkApp` smart contract', async () => {
    await localDeploy();
    const hash = zkApp.chessHash.get().toString();
    expect(hash).toEqual(
      '16949036686622336619774195769652466229758001802858488440473982563212102836386'
    );
  });

  it('generates a game, does a valid move and then reset game', async () => {
    await localDeploy();

    let defaultChessBoard = ChessBoard.default();

    const hash = zkApp.chessHash.get().toString();
    expect(hash).toEqual(
      '16949036686622336619774195769652466229758001802858488440473982563212102836386'
    );

    let gamePlayer1 = PrivateKey.random();
    let gamePlayer2 = PrivateKey.random();

    const txn = await Mina.transaction(senderAccount, () => {
      zkApp.reset(gamePlayer1.toPublicKey(), gamePlayer2.toPublicKey());
    });

    await txn.prove();
    await txn.sign([senderKey]).send();

    const hash2 = zkApp.chessHash.get().toString();
    expect(hash2).toEqual(
      '16949036686622336619774195769652466229758001802858488440473982563212102836386'
    );

    const txn2 = await Mina.transaction(senderAccount, () => {
      zkApp.placePiece(
        defaultChessBoard,
        // move a pawn 2 spaces forward
        UInt32.from(0),
        UInt32.from(1),
        UInt32.from(0),
        UInt32.from(3),
        gamePlayer1
      );
    });

    await txn2.prove();
    await txn2.sign([senderKey]).send();

    // moving piece with wrong board should fail
    try {
      const txn3 = await Mina.transaction(senderAccount, () => {
        zkApp.placePiece(
          defaultChessBoard,
          // move a pawn 2 spaces forward
          UInt32.from(0),
          UInt32.from(1),
          UInt32.from(0),
          UInt32.from(3),
          gamePlayer1
        );
      });
      let res = await txn3.prove();
      await txn3.sign([senderKey]).send();
    } catch (err: any) {
      expect(err.message.startsWith('chess board hash matches')).toBeTruthy();
    }

    const updatedBoard = defaultChessBoard.changeCoordinate(
      UInt32.from(0),
      UInt32.from(1),
      UInt32.from(0),
      UInt32.from(3)
    );

    // moving piece with wrong player i.e out of turn should fail
    try {
      const txn3 = await Mina.transaction(senderAccount, () => {
        zkApp.placePiece(
          updatedBoard,
          // move a pawn 2 spaces forward
          UInt32.from(1),
          UInt32.from(1),
          UInt32.from(1),
          UInt32.from(3),
          gamePlayer1
        );
      });
      let res = await txn3.prove();
      await txn3.sign([senderKey]).send();
    } catch (err: any) {
      console.log(err.message);
      expect(
        err.message.startsWith('player is allowed to make the move')
      ).toBeTruthy();
    }

    // moving from an empty square should fail
    try {
      const txn3 = await Mina.transaction(senderAccount, () => {
        zkApp.placePiece(
          updatedBoard,
          // move a pawn 2 spaces forward
          UInt32.from(0),
          UInt32.from(1),
          UInt32.from(0),
          UInt32.from(3),
          gamePlayer2
        );
      });
      let res = await txn3.prove();
      await txn3.sign([senderKey]).send();
    } catch (err: any) {
      console.log(err.message);
      expect(
        err.message.startsWith(
          'piece is expected to be there at the current location or location should be valid at the first place'
        )
      ).toBeTruthy();
    }

    const hash3 = zkApp.chessHash.get().toString();
    expect(hash3).toEqual(updatedBoard.hash().toString());
  });

  // it('correctly updates the num state on the `Add` smart contract', async () => {
  //   await localDeploy();

  //   // update transaction
  //   const txn = await Mina.transaction(senderAccount, () => {
  //     zkApp.update();
  //   });
  //   await txn.prove();
  //   await txn.sign([senderKey]).send();

  //   const updatedNum = zkApp.num.get();
  //   expect(updatedNum).toEqual(Field(3));
  // });
});
