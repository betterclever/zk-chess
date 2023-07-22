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
  static default(): ChessBoard {
    return this.fromArray([
      // write transpose of this
      [10, 7, 0, 0, 0, 0, 1, 4],
      [8, 7, 0, 0, 0, 0, 1, 2],
      [9, 7, 0, 0, 0, 0, 1, 3],
      [11, 7, 0, 0, 0, 0, 1, 5],
      [12, 7, 0, 0, 0, 0, 1, 6],
      [9, 7, 0, 0, 0, 0, 1, 3],
      [8, 7, 0, 0, 0, 0, 1, 2],
      [10, 7, 0, 0, 0, 0, 1, 4],
    ]);
  }

  static fromArray(arr: number[][]): ChessBoard {
    const value = arr.map((row) => row.map((piece) => Field(piece)));
    return new ChessBoard({ value });
  }

  // retuns zero if the coordinates are invalid or empty else the piece number
  findPieceAtCoordinates(x: UInt32, y: UInt32): Field {
    let currentPositionPiece: Field = Field(0);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        currentPositionPiece = Provable.if(
          x.equals(UInt32.from(i)).and(y.equals(UInt32.from(j))),
          this.value[i][j],
          currentPositionPiece
        );
      }
    }

    return currentPositionPiece;
  }

  // Change coordinate and return a new board
  changeCoordinate(
    currentX: UInt32,
    currentY: UInt32,
    newX: UInt32,
    newY: UInt32
  ): ChessBoard {
    let currentPositionPiece = this.findPieceAtCoordinates(currentX, currentY);

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        // make current position zero
        this.value[i][j] = Provable.if(
          currentX.equals(UInt32.from(i)).and(currentY.equals(UInt32.from(j))),
          Field(0),
          this.value[i][j]
        );

        // make new position the current piece
        this.value[i][j] = Provable.if(
          newX.equals(UInt32.from(i)).and(newY.equals(UInt32.from(j))),
          currentPositionPiece,
          this.value[i][j]
        );
      }
    }

    return this;
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
      for (let j = 0; j < 8; j++) {
        // check if the piece is between curX and newX
        let isSquareInXPath = Provable.if(
          curX
            .lessThan(UInt32.from(i))
            .and(newX.greaterThan(UInt32.from(i)))
            .and(curY.equals(newY)),
          Bool(true),
          Bool(false)
        );
        // check if the piece is between curY and newY
        let isSquareInYPath = Provable.if(
          curY
            .lessThan(UInt32.from(j))
            .and(newY.greaterThan(UInt32.from(j)))
            .and(curX.equals(newX)),
          Bool(true),
          Bool(false)
        );

        let isSquareInPath = isSquareInXPath.or(isSquareInYPath);
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

  checkFinalPlacement(newX: UInt32, newY: UInt32): Bool {
    let pieceAtNewPosition = this.findPieceAtCoordinates(newX, newY);

    // check if empty
    let isEmpty = pieceAtNewPosition.equals(Field(0));

    // check if the piece is of different color
    let isDifferentColor = pieceAtNewPosition
      .greaterThanOrEqual(Field(7))
      .not();

    return isEmpty.or(isDifferentColor);
  }

  checkValidKingMove(
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

    // the diff between both coordinates can be atmost 1
    let xLarge = Provable.if(newX.greaterThan(curX), newX, curX);
    let xSmall = Provable.if(newX.greaterThan(curX), newX, curX);

    let xDiffAbs = xLarge.sub(xSmall);

    let yLarge = Provable.if(newY.greaterThan(curY), newY, curY);
    let ySmall = Provable.if(newY.greaterThan(curY), newY, curY);

    let yDiffAbs = yLarge.sub(ySmall);

    let isDiffAtMostOne = Provable.if(
      xDiffAbs
        .lessThanOrEqual(UInt32.from(1))
        .and(yDiffAbs.lessThanOrEqual(UInt32.from(1))),
      Bool(true),
      Bool(false)
    );

    return isAtSamePosition
      .not()
      .and(newXInsideBoard)
      .and(newYInsideBoard)
      .and(isDiffAtMostOne);
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
    let newPositionFinalPlacementValid = this.checkFinalPlacement(newX, newY);

    return isAtSamePosition
      .not()
      .and(newXInsideBoard)
      .and(newYInsideBoard)
      .and(onlyOneOfTheCoordinatesChanged)
      .and(pathIsClear)
      .and(newPositionFinalPlacementValid);
  }

  checkIfDiaognalPathClear(
    curX: UInt32,
    curY: UInt32,
    newX: UInt32,
    newY: UInt32
  ): Bool {
    // check if the path is clear
    // if the x is same then check if the path is clear in y
    let isPathClear = Bool(true);

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
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
    // // since it's Uint32, we can't use abs as there is an underflow check which reset to zero if the number is negative
    let xLarge = Provable.if(newX.greaterThan(curX), newX, curX);
    let xSmall = Provable.if(newX.greaterThan(curX), newX, curX);

    let xDiffAbs = xLarge.sub(xSmall);

    let yLarge = Provable.if(newY.greaterThan(curY), newY, curY);
    let ySmall = Provable.if(newY.greaterThan(curY), newY, curY);

    let yDiffAbs = yLarge.sub(ySmall);

    // validate if they are same
    let isSameDiff = Provable.if(
      xDiffAbs.equals(yDiffAbs),
      Bool(true),
      Bool(false)
    );

    // check if the Bishop path i.e. diagonal path is clear.
    let pathIsClear = this.checkIfDiaognalPathClear(curX, curY, newX, newY);

    // 3. validate if bishop can move at this place by either killing or moving to an empty place
    // if there's a piece at newX and newY then it should be of different color and the bishop should be able to kill it
    // if there's no piece at newX and newY then the bishop should be able to move there
    let finalPlacementValid = this.checkFinalPlacement(newX, newY);

    return newXInsideBoard
      .and(newYInsideBoard)
      .and(isSameDiff)
      .and(pathIsClear)
      .and(finalPlacementValid);
  }

  checkValidKnightMove(
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

    let xLarge = Provable.if(newX.greaterThan(curX), newX, curX);
    let xSmall = Provable.if(newX.greaterThan(curX), newX, curX);

    let xDiffAbs = xLarge.sub(xSmall);

    let yLarge = Provable.if(newY.greaterThan(curY), newY, curY);
    let ySmall = Provable.if(newY.greaterThan(curY), newY, curY);

    let yDiffAbs = yLarge.sub(ySmall);

    // 2. alidate if they are +1 and +2 or +2 and +1
    let isDiffValid = xDiffAbs
      .equals(UInt32.from(1))
      .and(yDiffAbs.equals(UInt32.from(2)))
      .or(xDiffAbs.equals(UInt32.from(2)).and(yDiffAbs.equals(UInt32.from(1))));

    // 3. validate if knight can move at this place by either killing or moving to an empty place
    // if there's a piece at newX and newY then it should be of different color and the knight should be able to kill it
    // if there's no piece at newX and newY then the knight should be able to move there
    let finalPlacementValid = this.checkFinalPlacement(newX, newY);

    return newXInsideBoard
      .and(newYInsideBoard)
      .and(isDiffValid)
      .and(finalPlacementValid);
  }

  checkValidPawnMove(
    curX: UInt32,
    curY: UInt32,
    newX: UInt32,
    newY: UInt32
  ): Bool {
    Provable.log('curX', curX);
    Provable.log('curY', curY);
    Provable.log('newX', newX);
    Provable.log('newY', newY);

    let isAtSamePosition = curX.equals(newX).and(curY.equals(newY));
    let newXInsideBoard = newX
      .greaterThanOrEqual(UInt32.from(0))
      .and(newX.lessThanOrEqual(UInt32.from(7)));

    let newYInsideBoard = newY
      .greaterThanOrEqual(UInt32.from(0))
      .and(newY.lessThanOrEqual(UInt32.from(7)));

    // check if pawn is moving forward
    let isValidMoveForward = curX
      .equals(newX)
      .and(curY.add(UInt32.from(1)).equals(newY));
    let isValidMoveForward2 = curX.equals(newX).and(
      curY
        .add(UInt32.from(2))
        .equals(newY)
        .and(curY.equals(UInt32.from(1)))
    );

    let xLarge = Provable.if(newX.greaterThan(curX), newX, curX);
    let xSmall = Provable.if(newX.greaterThan(curX), newX, curX);

    let xDiffAbs = xLarge.sub(xSmall);
    Provable.log('xDiffAbs', xDiffAbs);
    Provable.log('newXIB', newXInsideBoard);
    Provable.log('newYIB', newYInsideBoard);
    Provable.log('isValidMoveForward', isValidMoveForward);
    Provable.log('isValidMoveForward2', isValidMoveForward2);
    Provable.log('isAtSamePosition', isAtSamePosition);

    // check if pawn is killing
    let isPawnKilling = xDiffAbs
      .equals(UInt32.from(1))
      .and(curY.add(UInt32.from(1)).equals(newY));
    let isFinalPlacementValid = this.checkFinalPlacement(newX, newY);
    Provable.log('isPawnKilling', isPawnKilling);
    Provable.log('isFinalPlacementValid', isFinalPlacementValid);

    Provable.log(
      'final condition',
      isAtSamePosition
        .not()
        .and(newXInsideBoard)
        .and(newYInsideBoard)
        .and(isFinalPlacementValid)
        .and(isValidMoveForward.or(isValidMoveForward2).or(isPawnKilling))
    );

    return isAtSamePosition
      .not()
      .and(newXInsideBoard)
      .and(newYInsideBoard)
      .and(isFinalPlacementValid)
      .and(isValidMoveForward.or(isValidMoveForward2).or(isPawnKilling));
  }

  hash() {
    return Poseidon.hash(this.value.flat());
  }
}

export default class ChessZkApp extends SmartContract {
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
    const chessBoard = ChessBoard.default();
    this.chessHash.set(chessBoard.hash());
  }

  @method reset(player1: PublicKey, player2: PublicKey) {
    this.player1.set(player1);
    this.player2.set(player2);
    this.turn.set(Bool(true));

    // reset the chess board by adding the right pieces at the right places
    // 1-6 is black, 7-12 is white
    const chessBoard = ChessBoard.default();
    this.chessHash.set(chessBoard.hash());
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
    this.chessHash.assertEquals(this.chessHash.get());
    this.player1.assertEquals(this.player1.get());
    this.player2.assertEquals(this.player2.get());
    this.turn.assertEquals(this.turn.get());

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
      .assertTrue('player is allowed to make the move');

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
    Provable.log('currentPositionPiece', currentPositionPiece);
    player1Turn
      .not()
      .and(currentPositionPiece.lessThanOrEqual(Field(6)))
      .or(player1Turn.and(currentPositionPiece.greaterThanOrEqual(Field(7))))
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

    let validQueenMove = validRookMove.or(validBishopMove);
    let validKingMove = currentBoard.checkValidKingMove(
      currentX,
      currentY,
      newX,
      newY
    );

    let validKnightMove = currentBoard.checkValidKnightMove(
      currentX,
      currentY,
      newX,
      newY
    );

    let validPawnMove = currentBoard.checkValidPawnMove(
      currentX,
      currentY,
      newX,
      newY
    );

    Provable.log('validRookMove', validRookMove);
    Provable.log('validBishopMove', validBishopMove);
    Provable.log('validQueenMove', validQueenMove);
    Provable.log('validKingMove', validKingMove);
    Provable.log('validKnightMove', validKnightMove);
    Provable.log('validPawnMove', validPawnMove);

    Provable.log('currentPositionPiece', currentPositionPiece);
    Provable.log('board', currentBoard.value);

    // assert that the move is valid for the piece
    const isPawnSupposedToMoveAndIsValid = Provable.if(
      currentPositionPiece
        .equals(Field(1))
        .or(currentPositionPiece.equals(Field(7))),
      validPawnMove,
      Bool(true)
    );

    isPawnSupposedToMoveAndIsValid.assertEquals(
      Bool(true),
      'pawn move is valid'
    );

    const isKnightSupposedToMoveAndIsValid = Provable.if(
      currentPositionPiece
        .equals(Field(2))
        .or(currentPositionPiece.equals(Field(8))),
      validKnightMove,
      Bool(true)
    );

    isKnightSupposedToMoveAndIsValid.assertEquals(
      Bool(true),
      'knight move is valid'
    );

    const isBishopSupposedToMoveAndIsValid = Provable.if(
      currentPositionPiece
        .equals(Field(3))
        .or(currentPositionPiece.equals(Field(9))),
      validBishopMove,
      Bool(true)
    );

    isBishopSupposedToMoveAndIsValid.assertEquals(
      Bool(true),
      'bishop move is valid'
    );

    const isRookSupposedToMoveAndIsValid = Provable.if(
      currentPositionPiece
        .equals(Field(4))
        .or(currentPositionPiece.equals(Field(10))),
      validRookMove,
      Bool(true)
    );

    isRookSupposedToMoveAndIsValid.assertEquals(
      Bool(true),
      'rook move is valid'
    );

    const isQueenSupposedToMoveAndIsValid = Provable.if(
      currentPositionPiece
        .equals(Field(5))
        .or(currentPositionPiece.equals(Field(11))),
      validQueenMove,
      Bool(true)
    );

    isQueenSupposedToMoveAndIsValid.assertEquals(
      Bool(true),
      'queen move is valid'
    );

    const isKingSupposedToMoveAndIsValid = Provable.if(
      currentPositionPiece
        .equals(Field(6))
        .or(currentPositionPiece.equals(Field(12))),
      validKingMove,
      Bool(true)
    );

    isKingSupposedToMoveAndIsValid.assertEquals(
      Bool(true),
      'king move is valid'
    );

    // Move the piece
    // update the board
    let newBoard = currentBoard.changeCoordinate(
      currentX,
      currentY,
      newX,
      newY
    );

    // update the hash
    this.chessHash.set(newBoard.hash());
    this.turn.set(this.turn.get().not());

    // check if the move is valid
    // update the board
    // update the hash
  }
}
