import _ from 'lodash'
import $ from 'jquery'
import strftime from 'SRC/util/strftime'
import Puzzle from 'SRC/models/puzzle'
import Base from 'SRC/components/base'
import Grid from './grid'
import Prompt from './prompt'
import ClueList from './clues'
import Metadata from './metadata'
import Toolbar from './toolbar'
import './index.scss'

const TEMPLATE = `
  <div class="puzzle">
    <div class="puzzle-wrapper">
      <div class="grid-and-prompt">
        <div class="prompt" />
        <div class="grid" />
      </div>
      <div class="clues-container" />
    </div>
  </div>
`

/**
 * Default Puzzle view class.
 */
export class PuzzleView extends Base.View {
  constructor({template = TEMPLATE, ...opts} = {}) {
    super({template, ...opts})
    this.$wrapper = this.$('.puzzle-wrapper')
    this.$cluesContainer = this.$('.clues-container')
    this.$prompt = this.$('.prompt')
    this.$grid = this.$('.grid')
    this.$gridAndPrompt = this.$('.grid-and-prompt')
    this._gridAspect = 1
    // Setup resizing
    this.handleResize = _.throttle(this.handleResize.bind(this), 10)
    $(window).resize(this.handleResize)
    $(this.handleResize) // Defer initial resize until after first layout
  }

  /**
   * Adds the toolbar sub-view
   * @param {View} view
   */
  addToolbar(view) {
    this.$el.prepend(view.$el)
  }

  /**
   * Adds the grid sub-view.
   * @param {View} view
   */
  addGrid(view) {
    view.appendTo(this.$grid)
  }

  /**
   * Adds the clue prompt sub-view.
   * @param {View} view
   */
  addPrompt(view) {
    view.appendTo(this.$prompt)
  }

  /**
   * Adds a clue list sub-view.
   * @param {View} view
   */
  addClueList(view) {
    view.appendTo(this.$cluesContainer)
  }

  /**
   * Adds a metadata sub-view.
   * @param {View} view
   * @param {('above'|'below')} [position] - position above or below
   * @param {('prompt'|'grid'|'layout')} [relative] - relative to this element
   */
  addMetadata(view, position = 'below', relative = 'grid') {
    view.$el.addClass('metadata-' + position + '-' + relative)
    if (relative === 'layout') {
      if (position === 'above') {
        this.$el.prepend(view.$el)
      } else {
        this.$el.append(view.$el)
      }
    } else {
      view.appendTo(this.$gridAndPrompt)
    }
  }

  /**
   * Sets responsive mode.
   * @param {boolean} [responsive]
   */
  setResponsive(responsive = true) {
    this._isResponsive = responsive
  }

  /** Is this view in responsive mode?  */
  isResponsive() {
    return this._isResponsive
  }

  /**
   * Shows or hides the clue prompt.
   * @param {boolean} state
   */
  togglePrompt(state) {
    if (state == null) state = this.$el.hasClass('prompt-off')
    this.setExclusiveClass('prompt', state ? 'on' : 'off')
  }

  /**
   * Sets the overall layout orientation.
   * @param {('landscape'|'portrait')} orientation
   */
  setLayoutOrientation(orientation) {
    this._isLandscape = orientation === 'landscape'
    this.setExclusiveClass('orientation', orientation)
  }

  /** Is this view in landscape orientation? */
  isLandscape() {
    return this._isLandscape
  }

  /** Is this view in portrait orientation? */
  isPortrait() {
    return !this._isLandscape
  }

  /**
   * Sets the grid aspect ratio.
   * @param {number} cols
   * @param {number} rows
   */
  setGridAspectRatio(cols, rows) {
    this._gridAspect = cols / rows
  }

  /**
   * Sets the clue layout class.
   * @param {string} layout - css class (will be `clues-${layout}`)
   */
  setClueLayout(layout) {
    this.setExclusiveClass('clues', layout)
  }

  // Sizing
  show() {
    super.show()
    this.handleResize() // Update grid/styles
    return this
  }

  handleResize() {
    const width = this.$wrapper.width()
    const height = this.$wrapper.height()
    const canSkip = width === 0 || height === 0 ||
      (this._lastWidth === width && this._lastHeight === height)
    if (canSkip) return
    // Send responsive resize to presenter
    if (this.isResponsive()) {
      this.presenter.onResize(this._lastWidth, this._lastHeight, width, height)
      // We have to resize the grid here the first time so the calculations
      // below will work correctly
      if (!this._lastWidth || !this._lastHeight) this.presenter.resizeGrid()
    }
    // Calculate the max area allowed for the grid
    if (this.isLandscape()) {
      // Constrain to the max necessary width based on height and aspect ratio
      const maxWidth =
        this.$grid.height() * this._gridAspect +
        (this.$gridAndPrompt.width() - this.$grid.width())
      this.$gridAndPrompt.css({maxWidth: maxWidth, maxHeight: ''})
    } else {
      // Constrain to the max necessary height based on width and aspect ratio
      const maxHeight =
        this.$grid.width() / this._gridAspect +
        (this.$gridAndPrompt.height() - this.$grid.height())
      this.$gridAndPrompt.css({maxWidth: '', maxHeight: maxHeight})
    }
    this.presenter.resizeGrid()
    this._lastWidth = width
    this._lastHeight = height
  }
}

// Presenter config

const BYLINE_FORMAT = ({author, editor, copyright}) => {
  // Normalize author and editor
  if (!editor) [, author, editor] = author.match(/(.*)\/(.*)/) || ['', author]
  if (author) author = 'By ' + author.replace(/^\s*by\s+/i, '')
  if (editor) editor = 'Edited by ' + editor.replace(/^\s*\w*\s*by\s+/i, '')
  author = author && editor ? author + ' \u25AA ' + editor : author || editor
  // Normalize copyright
  if (copyright && !/\u00A9/.test(copyright)) {
    copyright = '\u00A9 ' + copyright.replace(/^\s*\(c\)\s*/i, '')
  }
  // Template
  return `
    <span class="meta-author">${author || ''}</span>
    <span class="meta-copyright">${copyright || ''}</span>
  `
}

const TITLE_FORMAT = ({title, date}) => {
  if (title) return title
  if (date) return strftime(date, '<b>DDDD</b>, MMMM D, YYYY')
}

const DEFAULT_CONFIG = {
  responsive: true,
  prompt: true,
  clues: 'vertical',
  orientation: 'landscape',
  metadata: [
    {below: 'grid', class: 'meta-title', format: TITLE_FORMAT},
    {below: 'grid', class: 'meta-byline', format: BYLINE_FORMAT},
  ],
}

/**
 * Puzzle presenter class.
 */
class PuzzlePresenter extends Base.Presenter {
  /**
   * Constructs a new PuzzlePresenter.
   * @param {object} opts - options passed to {@link PuzzlePresenter#configure}
   * @param {View} [opts.view={@link PuzzleView}]
   * @param {(Node|jQuery|selector)} [opts.el] - element to attach the view to
   */
  constructor({el, view = new PuzzleView(), ...opts} = {}) {
    super({view, el, ...opts})
    this.puzzle = null
    this.prompt = new Prompt()
    this.grid = new Grid()
    this.toolbar = new Toolbar()
    this.clues = {}
    this.meta = []
    this.view.addToolbar(this.toolbar)
    this.view.addPrompt(this.prompt.view)
    this.view.addGrid(this.grid.view)
    // Set initial config
    this._config = {}
    this.configure(_.assign({}, DEFAULT_CONFIG, opts))
  }

  /**
   * Sets the puzzle for the {@link PuzzleView}
   * @param {Puzzle} puzzle
   */
  setPuzzle(puzzle) {
    this.puzzle = puzzle
    this.prompt.setPuzzle(puzzle)
    this.toolbar.setPuzzle(puzzle)
    this._setupClues()
    this.meta.forEach(m => m.setPuzzle(puzzle))
    // Setup grid last so we can trigger a resize after other elements have
    // determined their size
    this.view.setGridAspectRatio(puzzle.cols, puzzle.rows)
    this.grid.setPuzzle(puzzle)
    this.view.handleResize()
    // Trigger events
    this.puzzle.moveCursor(
      this.puzzle.currentSquare,
      this.puzzle.currentOrientation
    )
  }

  /**
   * Loads a puzzle from data or a url.
   * @param {object} opts
   * @param {string} opts.type - puzzle format
   * @param {string} [opts.url] - puzzle url
   * @param {*} [opts.data] - puzzle data (specific to format)
   * @returns {Promise}
   */
  loadPuzzle({type, url, data}) {
    if (url) {
      return Puzzle.fetch(type, url).then(p => { this.setPuzzle(p); return p })
    } else {
      return new Promise((resolve, reject) => {
        const p = Puzzle.load(type, data)
        this.setPuzzle(p)
        resolve(p)
      })
    }
  }

  /**
   * Sets configuration options.
   * @param {object} opts - key/value pairs to set
   * @param {boolean} [opts.responsive] - turn on/off responsive layout
   * @param {boolean} [opts.prompt] - show/hide the prompt
   * @param {string} [opts.clues] - clues layout
   * @param {string} [opts.orientation] - overall layout orientation
   * @param {object} [opts.metadata] - metadata config
   */
  configure(opts) {
    // Config for the configure function
    this._configFunctions = this._configFunctions || {
      responsive: this.setResponsive,
      prompt: this.togglePrompt,
      clues: this.setClueLayout,
      orientation: this.setLayoutOrientation,
      metadata: this.setMetadata,
      toolbar: this.configureToolbar,
    }
    // Execute the specified function for each option
    for (const k in opts) {
      const value = opts[k]
      if (value != null) {
        const func = this._configFunctions[k]
        if (!func) throw new Error(`Unknown configuration option '${k}'`)
        func.call(this, value)
        this._config[k] = value
      }
    }
  }

  /**
   * Gets the value for the given config key.
   * @param {string} key config key
   */
  getConfig(key) {
    return this._config[key]
  }

  /**
   * Toggles responsive mode
   * @param {boolean} [responsive]
   */
  setResponsive(responsive = true) {
    this.view.setResponsive(responsive)
  }

  /**
   * Shows or hides the clue prompt.
   * @param {boolean} state
   */
  togglePrompt(state) {
    this.view.togglePrompt(state)
  }

  /**
   * Sets the clue layout.
   * @param {('horizontal'|'vertical'|'tiny')} layout
   */
  setClueLayout(layout) {
    this.view.setClueLayout(layout)
    // Update children
    for (const c of Object.values(this.clues)) c.setLayout(layout)
    // Save in case we add more clue lists
    this._cluesLayout = layout
  }

  /**
   * Sets the overall layout orientation.
   * @param {('portrait'|'landscape')} orientation
   */
  setLayoutOrientation(orientation) {
    this.view.setLayoutOrientation(orientation)
  }

  /**
   * Sets the toolbar config
   * @param {object[]} tools - array of tool definitions
   * @param {string} tools[].label - menu label
   * @param {string} [tools[].html] - item html override (default: label)
   * @param {object} [tools[].events] - event mapping
   * @param {array} [tools[].items] - sub items
   */
  configureToolbar(tools) {
    this.toolbar.setTools(tools)
  }

  /**
   * Adds a metadata view
   * @param {object} opts
   * @param {function} opts.format - metadata formatter
   * @param {string} [opts.class] - css class to add
   * @param {('grid'|'prompt')} [opts.above] - place above grid or prompt
   * @param {('grid'|'prompt')} [opts.below] - place below grid or prompt
   *
   * @example
   * // Format function takes (metadata, puzzle)
   * this.setMetadata({
   *  format: ({title, author}) => `${title} | by ${author}`,
   *  above: 'prompt'
   * })
   */
  addMetadata(opts) {
    // Build metadata presenter
    const meta = new Metadata({format: opts.format})
    if (opts.class) meta.$el.addClass(opts.class)
    meta.setPuzzle(this.puzzle)
    // Add to root view
    this.view.addMetadata(
      meta.view,
      opts.above ? 'above' : 'below',
      opts.above || opts.below
    )
    this.meta.push(meta)
  }

  /**
   * Sets metadata config.
   * @param {object[]} configs - {@link PuzzlePresenter#addMetadata} options
   */
  setMetadata(configs) {
    // Remove existing metdata views
    this.meta.forEach(v => v.remove())
    this.meta = []
    // Add new metadata views
    configs.forEach(c => this.addMetadata(c))
  }

  /** Triggers a grid resize. */
  resizeGrid() {
    this.grid.view.resizeGrid()
  }

  // Remote
  setRemoteState(state) {
    console.log('remote state', state)
    this.grid.setRemoteState(state)
  }

  // Additional UI
  _setupClues() {
    // Clear
    for (const orientation in this.clues) {
      this.clues[orientation].remove()
      delete this.clues[orientation]
    }
    // Rebuild
    for (const orientation in this.puzzle.clues) {
      const list = this.clues[orientation] =
        new ClueList({orientation: orientation})
      if (this._cluesLayout) list.setLayout(this._cluesLayout)
      this.view.addClueList(list.view)
      list.setPuzzle(this.puzzle)
    }
  }

  // Responsive
  onResize(lastWidth, lastHeight, width, height) {
    if (this.$el.width() < 576) { // Bootstrap small screen size
      // Trigger tiny mode
      this.configure({
        orientation: 'portrait',
        clues: 'tiny',
        prompt: false,
      })
      return
    }
    // Switch landscape / portrait
    if (this.view.isLandscape()) {
      if (width < height) {
        this.setLayoutOrientation('portrait')
      }
    } else {
      if (height < width) {
        this.setLayoutOrientation('landscape')
      }
    }
    // When squares get small enough, remove the prompt
    _.defer(() => {
      if (this.view.$el.hasClass('prompt-on')) {
        if (this.grid.view.getScale() < 0.75) {
          this.togglePrompt(false)
          this.resizeGrid()
        }
      } else {
        if (this.grid.view.getScale() > 0.9) {
          this.togglePrompt(true)
          this.resizeGrid()
        }
      }
    })
    // Adjust clue list orientation
    const $clues = this.view.$cluesContainer
    const cluesWidth = $clues.width()
    const [, minWidth] = $clues.css('min-width').match(/^(.*)px$/) || []
    if (cluesWidth === +minWidth) {
      this.setClueLayout('vertical')
    } else if (cluesWidth > 2 * minWidth) {
      this.setClueLayout('horizontal')
    } else if (this._cluesLayout === 'tiny') {
      // Moving from tiny mode -- default to vertical clues
      this.setClueLayout('vertical')
    }
  }
}

export default PuzzlePresenter
