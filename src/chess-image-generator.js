const { createCanvas, loadImage } = require("canvas");
const toBuffer = require('./buffer.js')
const { Chess } = require("chess.js");
const fs = require("fs");
const path = require("path");

const {
  cols,
  white,
  black,
  defaultSize,
  defaultLight,
  defaultDark,
  defaultStyle,
  filePaths,
} = require("./config/index");
/**
 *
 * @typedef {object} Options
 * @property {number} [size] Pixel length of desired image
 * @property {string} [light] Color of light squares
 * @property {string} [dark] Color of dark squares
 * @property {"merida"|"alpha"|"cheq"|"cburnett"|"leipzig"} [style] Desired style of pieces
 * @property {boolean} [drawLabels] Whether to draw row and column labels
 * @property {string} [labelLight] Color of labels on light squares
 * @property {string} [labelDark] Color of labels on dark squares
 * @property {boolean} [flipped] Whether the board is to be flipped or not
 */
/**
 * Object constructor, initializes options.
 * @param {Options} [options] Optional options
 */
function ChessImageGenerator(options = {}) {
  this.chess = new Chess();

  this.size = options.size || defaultSize;
  this.light = options.light || defaultLight;
  this.dark = options.dark || defaultDark;
  this.style = options.style || defaultStyle;
  this.drawLabels = options.drawLabels !== false;
  this.labelLight = options.labelLight || this.dark;
  this.labelDark = options.labelDark || this.light;
  this.flipped = options.flipped !== true;

  this.ready = false;
}

ChessImageGenerator.prototype = {
  /**
   * Loads PGN into chess.js object.
   * @param {string} pgn Chess game PGN
   */
  loadPGN(pgn) {
    if (!this.chess.load_pgn(pgn)) {
      throw new Error("PGN could not be read successfully");
    } else {
      this.ready = true;
    }
  },

  /**
   * Loads FEN into chess.js object
   * @param {string} fen Chess position FEN
   */
  loadFEN(fen) {
    if (!this.chess.load(fen)) {
      throw new Error("FEN could not be read successfully");
    } else {
      this.ready = true;
    }
  },

  /**
   * Loads position array into chess.js object
   * @param {string[][]} array Chess position array
   */
  loadArray(array) {
    this.chess.clear();

    for (let i = 0; i < array.length; i += 1) {
      for (let j = 0; j < array[i].length; j += 1) {
        if (array[i][j] !== "" && black.includes(array[i][j].toLowerCase())) {
          this.chess.put(
            {
              type: array[i][j].toLowerCase(),
              color: white.includes(array[i][j]) ? "w" : "b",
            },
            cols[j] + (8 - i)
          );
        }
      }
    }
    this.ready = true;
  },

  /**
   * Generates buffer image based on position
   * @returns {Promise<Buffer>} Image buffer
   */
  async generateBuffer() {
    if (!this.ready) {
      throw new Error("Load a position first");
    }

    const canvas = createCanvas(this.size, this.size);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = this.light;
    ctx.fillRect(0, 0, this.size, this.size);

    const fontSize = this.size / 8 / 10;
    ctx.font = `bold ${fontSize}pt Arial`
    const textPadding = fontSize * 0.5;

    const row = this.flipped ? r => 7 - r + 1 : r => r + 1;
    const col = this.flipped ? c => 7 - c : c => c;

    for (let i = 0; i < 8; i += 1) {
      for (let j = 0; j < 8; j += 1) {
        const x = (this.size / 8) * j;
        const y = (this.size / 8) * (7 - i);
        const width = this.size / 8;
        const height = this.size / 8;

        // Fill Dark Square
        if ((i + j) % 2 === 0) {
          ctx.fillStyle = this.dark;
          ctx.fillRect(x, y, width, height);
        }
        
        // Draw Row Numbers
        if (this.drawLabels && j == 0) {
          const text = `${row(i)}`;
          const { actualBoundingBoxAscent: letterHeight } = ctx.measureText(text);

          ctx.fillStyle = i % 2 == 0 ? this.labelDark : this.labelLight;
          ctx.fillText(
            text,
            x + textPadding,
            y + letterHeight + textPadding
          );
        }

        // Draw Column Letters
        if (this.drawLabels && i == 0) {
          const text = cols[col(j)];
          const { width: letterWidth } = ctx.measureText(text);
          ctx.fillStyle = j % 2 == 0 ? this.labelDark : this.labelLight;
          ctx.fillText(
            text,
            x + width - letterWidth - textPadding,
            y + height - textPadding
          );
        }


        // Draw Piece Image
        const piece = this.chess.get(cols[col(j)] + row(i));
        if (
          piece &&
          piece.type !== "" &&
          black.includes(piece.type.toLowerCase())
        ) {
          const image = `resources/${this.style}/${
            filePaths[`${piece.color}${piece.type}`]
          }.png`;
          const imageFile = await loadImage(path.join(__dirname, image));
          await ctx.drawImage(imageFile, x, y, width, height);
        }
      }
    }

    return toBuffer(canvas)
  },

  /**
   * Generates PNG image based on position
   * @param {string} pngPath File name
   */
  async generatePNG(pngPath) {
    if (!this.ready) {
      throw new Error("Load a position first");
    }

    const buffer = await this.generateBuffer();

    fs.open(pngPath, "w", (err, fd) => {
      if (err) {
        throw new Error(`could not open file: ${err}`);
      }

      fs.write(fd, buffer, 0, buffer.length, null, (writeError) => {
        if (writeError) {
          throw new Error(`error writing file: ${writeError}`);
        }
        fs.close(fd, () => pngPath);
      });
    });
  },
};

module.exports = ChessImageGenerator;
