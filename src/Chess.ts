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
  UInt32,
} from 'snarkyjs';

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

  // retuns zero if the coordinates are invalid or empty else the piece number
  findPieceAtCoordinates(x: UInt32, y: UInt32): Field {
    let currentPositionPiece: Field = Field(0);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; i++) {
        currentPositionPiece = Provable.if(
          x.equals(UInt32.from(i)).and(y.equals(UInt32.from(j))),
          this.value[i][j],
          currentPositionPiece
        );
      }
    }

    return currentPositionPiece;
  }

  checkIfRookPathClear(
    curX: UInt32,
    curY: UInt32,
    newX: UInt32,
    newY: UInt32
  ): Bool {
    // check if the path is clear
    // if the x is same then check if the path is clear in y
    let isPathClear = Bool(true);

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; i++) {
        // check if the piece is between curX and newX
        let isSquareInXPath = Provable.if(
          curX.lessThan(UInt32.from(i)).and(newX.greaterThan(UInt32.from(i))),
          Bool(true),
          Bool(false)
        );
        // check if the piece is between curY and newY
        let isSquareInYPath = Provable.if(
          curY.lessThan(UInt32.from(j)).and(newY.greaterThan(UInt32.from(j))),
          Bool(true),
          Bool(false)
        );

        let isSquareInPath = isSquareInXPath.and(isSquareInYPath);
        // check piece at position
        let pieceAtPosition = this.value[i][j];
        // if there's a piece at positon and isSquareInPath is true then, set isPathClear to false
        isPathClear = Provable.if(
          pieceAtPosition.greaterThan(Field(0)).and(isSquareInPath),
          Bool(false),
          isPathClear
        );
      }
    }

    return isPathClear;
  }

  checkIfRookCanMove(newX: UInt32, newY: UInt32): Bool {
    let pieceAtNewPosition = this.findPieceAtCoordinates(newX, newY);

    // check if empty
    let isEmpty = pieceAtNewPosition.equals(Field(0));

    // check if the piece is of different color
    let isDifferentColor = pieceAtNewPosition
      .greaterThanOrEqual(Field(7))
      .not();

    return isEmpty.or(isDifferentColor);
  }

  checkValidRookMove(
    curX: UInt32,
    curY: UInt32,
    newX: UInt32,
    newY: UInt32
  ): Bool {
    // 1. validate if the new position is valid
    // newX and newY both should be less than 8
    // newX and newY both should be greater than 0
    // newX or newY should not be equal to curX or curY
    let isAtSamePosition = curX.equals(newX).and(curY.equals(newY));
    let newXInsideBoard = newX
      .greaterThanOrEqual(UInt32.from(0))
      .and(newX.lessThanOrEqual(UInt32.from(7)));
    let newYInsideBoard = newY
      .greaterThanOrEqual(UInt32.from(0))
      .and(newY.lessThanOrEqual(UInt32.from(7)));

    // validate that either of the coordinates is same
    let onlyOneOfTheCoordinatesChanged = curX
      .equals(newX)
      .or(curY.equals(newY))
      .and(isAtSamePosition.not());

    // 2. validate if path is clear
    let pathIsClear = this.checkIfRookPathClear(curX, curY, newX, newY);

    // 3. validate if rook can move at this place by either killing or moving to an empty place
    // if there's a piece at newX and newY then it should be of different color and the rook should be able to kill it
    // if there's no piece at newX and newY then the rook should be able to move there
    let newPositionFinalPlacementValid = this.checkIfRookCanMove(newX, newY);

    return newXInsideBoard
      .and(newYInsideBoard)
      .and(onlyOneOfTheCoordinatesChanged)
      .and(pathIsClear)
      .and(newPositionFinalPlacementValid);
  }

  checkValidBishopMove(
    curX: UInt32,
    curY: UInt32,
    newX: UInt32,
    newY: UInt32
  ): Bool {
    let isAtSamePosition = curX.equals(newX).and(curY.equals(newY));
    let newXInsideBoard = newX
      .greaterThanOrEqual(UInt32.from(0))
      .and(newX.lessThanOrEqual(UInt32.from(7)));
    let newYInsideBoard = newY
      .greaterThanOrEqual(UInt32.from(0))
      .and(newY.lessThanOrEqual(UInt32.from(7)));

    // validate that move was a diagonal move so the absolute of difference between x and y should be same.
    // since it's Uint32, we can't use abs as there is an underflow check which reset to zero if the number is negative
    let xDiff1 = curX.sub(newX);
    let xDiff2 = newX.sub(curX);
    let yDiff1 = curY.sub(newY);
    let yDiff2 = newY.sub(curY);

    let xDiffAbs = Provable.if(newX.greaterThan(curX), xDiff2, xDiff1);
    let yDiffAbs = Provable.if(newY.greaterThan(curY), yDiff2, yDiff1);

    // validate if they are same
    let isSameDiff = Provable.if(
      xDiffAbs.equals(yDiffAbs),
      Bool(true),
      Bool(false)
    );

    // check if the Bishop path i.e. diagonal path is clear.
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

  // validateRookMove(currentX: UInt32, currentY: UInt32, old) {

  // }

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

    // validate coordinates
    let currentPositionPiece = currentBoard.findPieceAtCoordinates(
      currentX,
      currentY
    );

    // assert that current position actually has a piece
    currentPositionPiece.assertNotEquals(
      Field(0),
      'piece is expected to be there at the current location or location should be valid at the first place'
    );

    // assert that the piece is the right color
    player1Turn
      .and(currentPositionPiece.greaterThanOrEqual(Field(7)))
      .or(player1Turn.not().and(currentPositionPiece.lessThanOrEqual(Field(6))))
      .assertTrue();

    // Step 2.2: Validate that the move is valid for the piece. To do that we actually have to run the validtiy function for all types of pieces
    // and then do an 'and' operation to find if it is actually valid for the piece we are working on
    let validRookMove = currentBoard.checkValidRookMove(
      currentX,
      currentY,
      newX,
      newY
    );
    let validBishopMove = currentBoard.checkValidBishopMove(
      currentX,
      currentY,
      newX,
      newY
    );

    // check if the move is valid
    // update the board
    // update the hash
  }
}
