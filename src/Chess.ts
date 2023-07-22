import {
  Field,
  SmartContract,
  state,
  State,
  method,
  Struct,
  Provable,
  Poseidon,
  Bool,
  PublicKey,
  PrivateKey,
} from 'snarkyjs';
import { UInt32 } from 'snarkyjs/dist/node/mina-signer/src/TSTypes';

/**
 * Basic Example
 * See https://docs.minaprotocol.com/zkapps for more info.
 *
 * The Add contract initializes the state variable 'num' to be a Field(1) value by default when deployed.
 * When the 'update' method is called, the Add contract adds Field(2) to its 'num' contract state.
 *
 * This file is safe to delete and replace with your own contract.
 */

export class ChessBoard extends Struct({
  // field represents the actual piece from 1-6 (black) and 7-12 (white)
  value: Provable.Array(Provable.Array(Field, 8), 8),
}) {
  static fromArray(arr: number[][]): ChessBoard {
    const value = arr.map((row) => row.map((piece) => Field(piece)));
    return new ChessBoard({ value });
  }

  hash() {
    return Poseidon.hash(this.value.flat());
  }
}

export class ChessZkApp extends SmartContract {
  @state(Field) chessHash = State<Field>();
  @state(PublicKey) player1 = State<PublicKey>();
  @state(PublicKey) player2 = State<PublicKey>();
  @state(Bool) turn = State<Bool>();
  @state(Bool) isGameOver = State<Bool>();

  init() {
    super.init();
    // reset the chess board by adding the right pieces at the right places
    // 1-6 is black, 7-12 is white
    // 1 - pawn
    // 2 - knight
    // 3 - bishop
    // 4 - rook
    // 5 - queen
    // 6 - king
    // 7 - pawn
    // 8 - knight
    // 9 - bishop
    // 10 - rook
    // 11 - queen
    // 12 - king
    const chessBoard = ChessBoard.fromArray([
      [4, 2, 3, 5, 6, 3, 2, 4],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0], // empty
      [0, 0, 0, 0, 0, 0, 0, 0], // empty
      [0, 0, 0, 0, 0, 0, 0, 0], // empty
      [0, 0, 0, 0, 0, 0, 0, 0], // empty
      [7, 7, 7, 7, 7, 7, 7, 7],
      [10, 8, 9, 11, 12, 9, 8, 10],
    ]);
  }

  // This function should validate which player is making the move
  // and if the move is valid
  @method placePiece(
    currentBoard: ChessBoard,
    currentX: UInt32,
    currentY: UInt32,
    newX: UInt32,
    newY: UInt32,
    signerPrivateKey: PrivateKey
  ) {
    // Step 0. Validate that user is sending the right board hash
    currentBoard
      .hash()
      .assertEquals(this.chessHash.get(), 'chess board hash matches');

    // Step 1. check if the player is allowed to make the move
    const signerPublicKey = PublicKey.fromPrivateKey(signerPrivateKey);
    const player1 = this.player1.get();
    const player2 = this.player2.get();
    const player1Turn = this.turn.get();

    signerPublicKey
      .equals(player1)
      .and(player1Turn)
      .or(signerPublicKey.equals(player2).and(player1Turn.not()))
      .assertTrue();

    // Step 2: Validate that the move is valid
    // Step 2.1: Validate that the piece is actually there and that it is the right color

    let currentXValue = currentX as number;
    let currentYValue = currentY as number;
    const piece: Field = currentBoard.value[currentXValue][currentYValue];

    // check if the piece is actually there
    piece.assertNotEquals(
      Field(0),
      'piece is expected to be there at the current location'
    );

    // check if the piece is the right color
    player1Turn
      .and(piece.greaterThanOrEqual(Field(7)))
      .or(player1Turn.not().and(piece.lessThanOrEqual(Field(6))))
      .assertTrue();

    // Step 2.2: Validate that the move is valid for the piece

    // check if the move is valid
    // update the board
    // update the hash
  }
}
