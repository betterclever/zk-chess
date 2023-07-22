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

  // returns the coordinates of a first occurence of a piece
  findPieceCoordinates(piece: Field): [UInt32, UInt32] {
    // coodinates 100, 100 means not found
    let pieceX = UInt32.from(100);
    let pieceY = UInt32.from(100);

    let pieceFound = Bool(false);
    let pieceToFind = piece;

    // find the piece
    for (let i = 0; i < 8; i++) {
      pieceFound = Provable.if(
        this.value[i][0].equals(pieceToFind),
        Bool(true),
        pieceFound
      );
      pieceX = Provable.if(
        this.value[i][0].equals(pieceToFind),
        UInt32.from(i),
        pieceX
      );
      pieceY = Provable.if(
        this.value[i][0].equals(pieceToFind),
        UInt32.from(0),
        pieceY
      );
    }

    pieceFound.assertTrue('Piece not found');
    return [pieceX, pieceY];
  }

  findWhiteKingCoordinates(): [UInt32, UInt32] {
    // coodinates 100, 100 means not found
    let kingX = UInt32.from(100);
    let kingY = UInt32.from(100);

    let kingPiece = Field.from(12);
    let kingCoordinates = this.findPieceCoordinates(kingPiece);

    kingX = kingCoordinates[0];
    kingY = kingCoordinates[1];

    return [kingX, kingY];
  }

  findBlackKingCoordinates(): [UInt32, UInt32] {
    // coodinates 100, 100 means not found
    let kingX = UInt32.from(100);
    let kingY = UInt32.from(100);

    let kingPiece = Field.from(6);
    let kingCoordinates = this.findPieceCoordinates(kingPiece);

    kingX = kingCoordinates[0];
    kingY = kingCoordinates[1];

    return [kingX, kingY];
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

  checkValidPieceMove(
    currentX: UInt32,
    currentY: UInt32,
    newX: UInt32,
    newY: UInt32
  ) {
    let validRookMove = this.checkValidRookMove(currentX, currentY, newX, newY);

    let validBishopMove = this.checkValidBishopMove(
      currentX,
      currentY,
      newX,
      newY
    );

    let validQueenMove = validRookMove.or(validBishopMove);
    let validKingMove = this.checkValidKingMove(currentX, currentY, newX, newY);

    let validKnightMove = this.checkValidKnightMove(
      currentX,
      currentY,
      newX,
      newY
    );

    let validPawnMove = this.checkValidPawnMove(currentX, currentY, newX, newY);

    // validate piece and move combination and return true if valid
    let currentPositionPiece = this.findPieceAtCoordinates(currentX, currentY);

    const isPawnSupposedToMoveAndIsValid = Provable.if(
      currentPositionPiece
        .equals(Field(1))
        .or(currentPositionPiece.equals(Field(7))),
      validPawnMove,
      Bool(true)
    );

    const isKingSupposedToMoveAndIsValid = Provable.if(
      currentPositionPiece
        .equals(Field(6))
        .or(currentPositionPiece.equals(Field(12))),
      validKingMove,
      Bool(true)
    );

    const isRookSupposedToMoveAndIsValid = Provable.if(
      currentPositionPiece
        .equals(Field(4))
        .or(currentPositionPiece.equals(Field(10))),
      validRookMove,
      Bool(true)
    );

    const isBishopSupposedToMoveAndIsValid = Provable.if(
      currentPositionPiece
        .equals(Field(3))
        .or(currentPositionPiece.equals(Field(9))),
      validBishopMove,
      Bool(true)
    );

    const isKnightSupposedToMoveAndIsValid = Provable.if(
      currentPositionPiece
        .equals(Field(2))
        .or(currentPositionPiece.equals(Field(8))),
      validKnightMove,
      Bool(true)
    );

    const isQueenSupposedToMoveAndIsValid = Provable.if(
      currentPositionPiece
        .equals(Field(5))
        .or(currentPositionPiece.equals(Field(11))),
      validQueenMove,
      Bool(true)
    );

    Provable.log('validRookMove', validRookMove);
    Provable.log('validBishopMove', validBishopMove);
    Provable.log('validQueenMove', validQueenMove);
    Provable.log('validKingMove', validKingMove);
    Provable.log('validKnightMove', validKnightMove);
    Provable.log('validPawnMove', validPawnMove);

    Provable.log('currentPositionPiece', currentPositionPiece);
    Provable.log('board', this.value);

    return isPawnSupposedToMoveAndIsValid
      .and(isKingSupposedToMoveAndIsValid)
      .and(isRookSupposedToMoveAndIsValid)
      .and(isBishopSupposedToMoveAndIsValid)
      .and(isKnightSupposedToMoveAndIsValid)
      .and(isQueenSupposedToMoveAndIsValid);
  }

  // king is in check if any of the pieces can kill in the current board position
  checkIfKingInCheck(piece: Field): Bool {
    piece
      .equals(Field(12))
      .or(piece.equals(Field(6)))
      .assertTrue('Piece is not a king');

    // find the king
    let kingCoordinates = this.findPieceCoordinates(piece);
    let kingX = kingCoordinates[0];
    let kingY = kingCoordinates[1];

    // check all the pieces if they can kill the king
    let canKingBeKilled = Bool(false);

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; i++) {
        let canPieceKillKing = this.checkValidPieceMove(
          UInt32.from(i),
          UInt32.from(j),
          kingX,
          kingY
        );

        canKingBeKilled = canKingBeKilled.or(canPieceKillKing);
      }
    }

    return canKingBeKilled;
  }

  checkIfKingCanMoveToAnyValidPlace(): Bool {
    // find the king
    let kingCoordinates = this.findWhiteKingCoordinates();
    let kingX = kingCoordinates[0];
    let kingY = kingCoordinates[1];

    // check around king for valid coordinates
    let canKingMove = Bool(false);

    // check if king can move to any of the valid places
    let canKingMoveToTopLeft = this.checkValidKingMove(
      kingX,
      kingY,
      kingX.sub(UInt32.from(1)),
      kingY.sub(UInt32.from(1))
    );

    let canKingMoveToTop = this.checkValidKingMove(
      kingX,
      kingY,
      kingX,
      kingY.sub(UInt32.from(1))
    );

    let canKingMoveToTopRight = this.checkValidKingMove(
      kingX,
      kingY,
      kingX.add(UInt32.from(1)),
      kingY.sub(UInt32.from(1))
    );

    let canKingMoveToLeft = this.checkValidKingMove(
      kingX,
      kingY,
      kingX.sub(UInt32.from(1)),
      kingY
    );

    let canKingMoveToRight = this.checkValidKingMove(
      kingX,
      kingY,
      kingX.add(UInt32.from(1)),
      kingY
    );

    let canKingMoveToBottomLeft = this.checkValidKingMove(
      kingX,
      kingY,
      kingX.sub(UInt32.from(1)),
      kingY.add(UInt32.from(1))
    );

    let canKingMoveToBottom = this.checkValidKingMove(
      kingX,
      kingY,
      kingX,
      kingY.add(UInt32.from(1))
    );

    let canKingMoveToBottomRight = this.checkValidKingMove(
      kingX,
      kingY,
      kingX.add(UInt32.from(1)),
      kingY.add(UInt32.from(1))
    );

    canKingMove = canKingMoveToTopLeft
      .or(canKingMoveToTop)
      .or(canKingMoveToTopRight)
      .or(canKingMoveToLeft)
      .or(canKingMoveToRight)
      .or(canKingMoveToBottomLeft)
      .or(canKingMoveToBottom)
      .or(canKingMoveToBottomRight);

    return canKingMove;
  }

  checkIfAnyPieceCanKillThePieceThatIsKillingTheKing(): Bool {
    // find the piece that is killing the king
    let kingCoordinates = this.findWhiteKingCoordinates();
    let kingX = kingCoordinates[0];
    let kingY = kingCoordinates[1];

    // check all the pieces if they can kill the king
    let canKingBeKilled = Bool(false);
    let kingKillingPieceCoordinateX: UInt32 = UInt32.from(100);
    let kingKillingPieceCoordinateY: UInt32 = UInt32.from(100);

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; i++) {
        let canPieceKillKing = this.checkValidPieceMove(
          UInt32.from(i),
          UInt32.from(j),
          kingX,
          kingY
        );

        kingKillingPieceCoordinateX = Provable.if(
          canPieceKillKing,
          UInt32.from(i),
          kingKillingPieceCoordinateX
        );

        kingKillingPieceCoordinateY = Provable.if(
          canPieceKillKing,
          UInt32.from(j),
          kingKillingPieceCoordinateY
        );

        canKingBeKilled = canKingBeKilled.or(canPieceKillKing);
      }
    }

    // so we now have the coordinates of the piece that is killing the king
    // now we need to test validity of move for all the pieces to see if they can kill the piece that is killing the king
    let canAnyPieceKillThePieceThatIsKillingTheKing = Bool(false);

    // check if any piece can kill the piece that is killing the king
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; i++) {
        let canPieceKillThePieceKillingTheKing = this.checkValidPieceMove(
          UInt32.from(i),
          UInt32.from(j),
          kingKillingPieceCoordinateX,
          kingKillingPieceCoordinateY
        );

        canAnyPieceKillThePieceThatIsKillingTheKing =
          canAnyPieceKillThePieceThatIsKillingTheKing.or(
            canPieceKillThePieceKillingTheKing
          );
      }
    }

    // if any piece can kill the piece that is killing the king then return true
    return canAnyPieceKillThePieceThatIsKillingTheKing;
  }

  // TODO: Fixme. Correct the logic.
  checkIfAnyPieceCanComeInBetweenThePieceThatIsKillingTheKing(): Bool {
    // find the piece that is killing the king
    let kingCoordinates = this.findWhiteKingCoordinates();
    let kingX = kingCoordinates[0];
    let kingY = kingCoordinates[1];

    // check all the pieces if they can kill the king
    let canKingBeKilled = Bool(false);
    let kingKillingPieceCoordinateX: UInt32 = UInt32.from(100);
    let kingKillingPieceCoordinateY: UInt32 = UInt32.from(100);

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; i++) {
        let canPieceKillKing = this.checkValidPieceMove(
          UInt32.from(i),
          UInt32.from(j),
          kingX,
          kingY
        );

        kingKillingPieceCoordinateX = Provable.if(
          canPieceKillKing,
          UInt32.from(i),
          kingKillingPieceCoordinateX
        );

        kingKillingPieceCoordinateY = Provable.if(
          canPieceKillKing,
          UInt32.from(j),
          kingKillingPieceCoordinateY
        );

        canKingBeKilled = canKingBeKilled.or(canPieceKillKing);
      }
    }

    return Bool(false);
  }

  // king is in checkmate if king is in check and there's no valid move for the king
  checkIfKingInCheckMate(piece: Field): Bool {
    piece
      .equals(Field(12))
      .or(piece.equals(Field(6)))
      .assertTrue('Piece is not a king');

    // // find the king
    // let kingCoordinates = this.findPieceCoordinates(piece);
    // let kingX = kingCoordinates[0];
    // let kingY = kingCoordinates[1];

    // check if king is in check
    let isKingInCheck = this.checkIfKingInCheck(piece);
    // check if king can move to any of the valid places
    let canKingMove = this.checkIfKingCanMoveToAnyValidPlace();

    // check if any other piece can kill the piece that is killing the king
    let canAnyPieceKillThePieceThatIsKillingTheKing =
      this.checkIfAnyPieceCanKillThePieceThatIsKillingTheKing();

    // check if any other piece can come in between the piece that is killing the king
    let canAnyPieceComeInBetweenThePieceThatIsKillingTheKing = Bool(false);

    return isKingInCheck.and(
      canKingMove
        .not()
        .and(canAnyPieceKillThePieceThatIsKillingTheKing.not())
        .and(canAnyPieceComeInBetweenThePieceThatIsKillingTheKing.not())
    );
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
    let isMoveValid = currentBoard.checkValidPieceMove(
      currentX,
      currentY,
      newX,
      newY
    );

    isMoveValid.assertTrue('move is valid');

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
