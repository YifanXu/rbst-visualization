// i miss react <3 <3 <3

/**
 * @typedef RBNode Object representing a node in the rbst
 * @type {object}
 * @property {number} k - Key of node
 * @property {boolean} red - If true the node is red node, otherwise black.
 * @property {RBNode} left - Left children of node.
 * @property {RBNode} right - Right children of node.
 */

// Settings for visualization
const visualSettings = {
  canvasX: 2000,
  canvasY: 800,
  paddingX: 50,
  paddingY: 50,
  maxLeafSeperation: 300,
  heightPerLevel: 150,
  heightDipOnRed: 20,
  nodeWidth: 70,
  nodeHeight: 40,
  highlightRadius: 7,
  colorRed: "#FF0000",
  colorBlack: "#000000",
  colorHighlight: "#e2e607"
}

// canvas object
var globalCTX;

// canvas dimension
var canvasWidth;
var canvasHeight;

// Reference to tree object
var tree;

// Reference to canvas element
var c;

// Positive > autoresolve a set number of times
// Zero > Do not autoresolve
// -1 > autoresolve all
var autoResolve = 0;

// Last performed operation, include a copy of the tree before operation
var lastOp = null

// Callback. When not null and called, sets itself to null to resolve the waitForInput promise
var resolvePending = null

// A value that is set on rewind during an animation.
// It is checked at the end of an operation to see if the tree should return to a previous state
var rewindStep = -1

// State flag for checking if the tree is in the middle of an operation
// Used to lock controls
var animating = false;

// Used to check which step we are currently on
// So the correct one is highlighted in history panel
var animationStep = 0;

/**
 * Toggles the flag for whether an animation is in progress and update ui elements accordingly
 */
function toggleAnimationLock() {
  animating = !animating

  $(".disableOnAnimate").prop("disabled", animating)
  $(".enableOnAnimate").prop("disabled", !animating)

  if (animating) {
    $("#message").addClass("inprogress")
  }
  else {
    $("#message").removeClass("inprogress")
  }
}

// Used to sync the highlighted element with the animationStep global variable
// (I hate imperative programming, declarative web frameworks <3 <3 <3)
function applyAnimationStep() {
  // Un-highlight everything
  $("#historyList > *").removeClass("active")

  $("#historyList").children().eq(animationStep).addClass("active")

  $("#prevStepButton").prop("disabled", animationStep === 0)
  $("#nextStepButton").prop("disabled", animationStep === $("#historyList").children().length - 1)
}

/**
 * Convert an array of messages to list items shown on the left timeline panel
 * @param {string[]} historyStack 
 */
function applyHistoryStack(historyStack) {
  // remove history list children
  $("#historyList").empty()

  for (let i = 0; i < historyStack.length; i++) {
    $("#historyList").append(
      $(`<div class="historyItem" tabindex="0"></div>`)
        .text(historyStack[i])
        .click(() => handleRewind(i))
        .on('keydown', e => { if (e.which === 13 || e.which === 32) handleRewind(i) })
    )
  }
}

/**
 * Suspend the current call until resolvePending() is called
 */
async function waitForInput () {
  return new Promise(resolve => {
    if (autoResolve) {
      autoResolve--
      resolve()
    }

    resolvePending = () => {
      resolvePending = null
      resolve()
    }
  })
}

/**
 * Class structure for holding the red-black tree
 */
class RBST {
  constructor(root = null) {
    this.root = root
  }

  /**
   * Insert a key k into the tree
   * @param {number} k key to insert into the tree
   */
  async put(k, historyStack) {
    this.root = await this.putInner(this.root, k, historyStack)

    this.root.red = false
  }

  /**
   * Recursively insert the key k into the red-black search tree
   * @param {RBNode} n current node
   * @param {number} k key to insert
   * @param {string[]} historyStack if not null, append all visualization messages to the historyStack array 
   * @param {RBNode} parent parent of n, null if root. Note that this is only used to fix a visualization bug with right rotate
   * @returns 
   */
  async putInner(n, k, historyStack, parent = null) {
    if (!n) {
      return { k, red: true }
    }

    // Pass down insertion
    if (k < n.k) {
      // insert on left
      await this.visualize(`Inserting left from ${n.k}`, n.k, historyStack)
      n.left = await this.putInner(n.left, k, historyStack, { node: n, side: 'l' })

      if (n.left.red && n.left.left && n.left.left.red) {

        await this.visualize(`Right Rotate at ${n.k}`, n.k, historyStack)
        n = this.rightRotate(n)

        /**
         * Notice that the above right rotate will causes a visualization bug right down below,
         * since we performed the right rotation but we have not corrected the parent reference
         * (which is normally done after we return n),
         * and we still need to do colorFlip on n after the right rotation
         * 
         * To fix this we are going to cheat a little bit
         * and prematurely set the parent's reference (or root refernece)
         * 
         * Removing the following 3 lines (along with the parent ref), the code will still work
         * but some nodes will disappear / behave strangely on visualize 
         */
        if (!parent) this.root = n
        else if (parent.side === 'l') parent.node.left = n
        else parent.node.right = n

        // After we cheekily get away with the crime above we can colorflip as normal
        await this.visualize(`Color Flip on ${n.k}`, n.k, historyStack, n)
        this.colorFlip(n)
      }
      else {
        await this.visualize(`Nothing happens at ${n.k}`, n.k, historyStack)
      }
    }
    else if (k > n.k) {
      // insert on right
      await this.visualize(`Inserting right from ${n.k}`, n.k, historyStack)
      n.right = await this.putInner(n.right, k, historyStack, { node: n, side: 'r' })

      if (n.right.red) {
        // uh oh, left rotate needed
        if (n.left && n.left.red) {
          // n has both left and right children, we just need to do colorflip
          await this.visualize(`Color Flip ${n.k}`, n.k, historyStack)
          this.colorFlip(n)
        }
        else {
          // we inserted a red the right of a red node, need to left rotate first
          await this.visualize(`Left Rotate at ${n.k}`, n.k, historyStack)
          return this.leftRotate(n)
        }
      }
      else {
        await this.visualize(`Nothing happens at ${n.k}`, n.k, historyStack)
      }
    }
    else {
      await this.visualize(`Found duplicate Key ${n.k}`, n.k, historyStack)
    }

    return n;
  }

  /**
   * Perform left rotation at h
   * @param {RBNode} h node to rotate
   * @returns {RBNode} Resulting node that should replace h
   */
  leftRotate(h) {
    const x = h.right
    h.right = x.left
    x.left = h
    x.red = h.red
    h.red = true
    return x
  }

  /**
   * Perform right rotation at h
   * @param {RBNode} h node to rotate
   * @returns {RBNode} Resulting node that should replace h
   */
  rightRotate(h) {
    const x = h.left
    h.left = x.right
    x.right = h
    x.red = h.red
    h.red = true
    return x
  }

  /**
   * Flip the color of h and its immediate children
   * @param {RBNode} h node to perform color flip at
   */
  colorFlip(h) {
    h.red = !h.red
    if (h.left) h.left.red = !h.left.red
    if (h.right) h.right.red = !h.right.red
  }

  /**
   * Recursively search for a node through a subtree
   * @param {number} k key to search with
   * @param {RBNode} [node] root of the subtree, default root
   * @returns {RBNode} resulting node in the tree
   */
  searchNode(k, node = this.root) {
    if (!node) return null
    if (k === node.k) return node
    if (k < node.k) return this.searchNode(k, node.left)
    else return this.searchNode(k, node.right)
  }

  /**
   * Repaint the canvas to reflect the structure of the tree
   * @param {string} message Message associated with the step for visualization
   * @param {number} activeKey key of the node to highlight. If autoresolve is on and there is an activeKey, the canvas is not painted
   * @param {string[]} [historyRef] If given, append the given message to the array
   * @returns 
   */
  async visualize(message, activeKey, historyRef) {
    animationStep++
    if (historyRef) {
      historyRef.push(message)
    }

    // Skip all re-rendering on autoresolve if a node is highlighted (which means it's an in-between step)
    if (autoResolve && activeKey) {
      autoResolve--
      return
    }

    // correct the highlighted element
    applyAnimationStep()

    globalCTX.clearRect(0, 0, canvasWidth, canvasHeight);
    $("#message").text(message)

    if (!this.root) return

    // First find the leaves node and assign them x coordinates
    const widthIndex = {}
    const leaves = []
    this.getAllLeaf(this.root, leaves)

    console.log('leaves', leaves)

    if (leaves.length <= 1) {
      // Special case, root always go in the middle
      widthIndex[leaves[0].k] = visualSettings.paddingX + visualSettings.maxLeafSeperation;
    }
    else {
      const leafXInterval = Math.min(visualSettings.maxLeafSeperation, (canvasWidth - visualSettings.paddingX * 2) / (leaves.length - 1));
      for (let i = 0; i < leaves.length; i++) {
        widthIndex[leaves[i].k] = visualSettings.paddingX + leafXInterval * i;
      }
    }

    // Recursively calculate all x values
    this.calcNodeX(this.root, widthIndex)

    // Recursively draw all nodes
    this.drawSubtree(this.root, -1, 0, widthIndex, globalCTX, activeKey)

    if (activeKey) await waitForInput()
  }

  /**
   * 
   * @param {RBNode} n node to draw
   * @param {number} depth depth of current node (in the 2-3 tree sense)
   * @param {number} redDip Number of consecutive red nodes above n
   * @param {Object.<number, number>} widthIndex calculated x coordinate of nodes
   * @param {CanvasRenderingContext2D} ctx canvas object
   * @param {number} activeKey key of active node to highlight, if any
   * @param {number[]} parentCoord parent node, can be null if n is root, used for drawing lines
   */
  drawSubtree(n, depth, redDip, widthIndex, ctx, activeKey, parentCoord = null) {
    if (!n) return

    if (n.red) {
      if (depth === -1) depth = 0 // Make sure we don't get -1 depth when root is red
      redDip++
    }
    else {
      depth++
      redDip = 0
    }

    // Is this already included in widthindex?
    let x = widthIndex[n.k]
    const y = visualSettings.paddingY + depth * visualSettings.heightPerLevel + redDip * visualSettings.heightDipOnRed

    this.drawSubtree(n.left, depth, redDip, widthIndex, ctx, activeKey, { x, y })
    this.drawSubtree(n.right, depth, redDip, widthIndex, ctx, activeKey, { x, y })

    // draw line
    if (parentCoord) {
      ctx.strokeStyle = n.red ? visualSettings.colorRed : visualSettings.colorBlack
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(parentCoord.x, parentCoord.y);
      ctx.stroke();
    }

    // check for highlight
    if (n.k === activeKey) {
      ctx.fillStyle = visualSettings.colorHighlight
      ctx.fillRect(x - visualSettings.nodeWidth / 2 - visualSettings.highlightRadius, y - visualSettings.nodeHeight / 2 - visualSettings.highlightRadius, visualSettings.nodeWidth + visualSettings.highlightRadius * 2, visualSettings.nodeHeight + visualSettings.highlightRadius * 2)
    }

    // draw rect
    ctx.fillStyle = n.red ? visualSettings.colorRed : visualSettings.colorBlack
    ctx.fillRect(x - visualSettings.nodeWidth / 2, y - visualSettings.nodeHeight / 2, visualSettings.nodeWidth, visualSettings.nodeHeight)

    // draw text
    ctx.fillStyle = "#FFFFFF"
    ctx.fillText(n.k.toString(), x, y + 10)

  }

  /**
   * visualization helper, gets all leaf* nodes of subtree (calculated for the sake of visualization only) and put it in arr
   * @param {RBNode} n ww
   * @param {RBNode[]} arr aa
   * @returns {boolean} true if n is considered a leaf
   */
  getAllLeaf(n, arr) {
    if (!n) return false

    const isLeftLeaf = this.getAllLeaf(n.left, arr);
    if (!n.right || !n.left || (n.left.red && n.right.red && isLeftLeaf)) {
      arr.push(n)
      this.getAllLeaf(n.right, arr);
      return true
    }
    this.getAllLeaf(n.right, arr);
    return false
  }

  /**
   * Reucursively calculate the x coordinate of given node
   * @param {RBNode} n Root of the subtree to calculate
   * @param {Object.<number, number>} widthIndex calculated x coordinate of nodes
   * @returns {[number, number]} left and right bounds of n's subtree
   */
  calcNodeX(n, widthIndex) {
    if (!n) {
      return [0, 0]
    }

    if (widthIndex[n.k]) {
      const leftNodeX = (n.left && widthIndex[n.left.k]) ? widthIndex[n.left.k] : widthIndex[n.k]
      return [leftNodeX - visualSettings.nodeWidth / 2, widthIndex[n.k] + visualSettings.nodeWidth / 2]
    }

    const [leftMin, leftMax] = this.calcNodeX(n.left, widthIndex)

    if (!n.right) {
      widthIndex[n.k] = (leftMin + leftMax) / 2
      return [leftMin, leftMax]
    }

    const [rightMin, rightMax] = this.calcNodeX(n.right, widthIndex)

    widthIndex[n.k] = (leftMax + rightMin) / 2

    return [leftMin, rightMax]
  }

  /**
   * Recursively deep copies a node
   * @param {RBNode} node 
   * @returns {RBNode} duplicated node
   */
  cloneNode(node) {
    return node ? {
      ...node,
      left: this.cloneNode(node.left),
      right: this.cloneNode(node.right)
    } : null
  }

  /**
   * Create a deep copy of the current tree
   * @returns {RBST} deep copy of this tree
   */
  clone() {
    return new RBST(this.cloneNode(this.root))
  }
}

/**
 * Handler for inserting a key
 * @param {Event} e dom event
 * @returns {boolean} whether the event should be propagated
 */
async function onInsertValue(e) {
  if (e) e.preventDefault()

  if (animating) return;

  const newKey = parseInt($("#numInput").val())
  $("#numInput").val('')
  $("#operationLabel").text(`Inserting ${newKey}`)

  performInsert(newKey)

  return false
}

/**
 * Handler for reseting tree
 */
async function handleResetTree() {
  tree = new RBST()
  applyHistoryStack([])
  await tree.visualize("Ready")
}

/**
 * Handler for initializing tree
 * @param {number} count number of nodes to put in the tree at initialization
 */
async function initTree(count) {
  let arr = new Array(count)

  // init array of numbers
  for (let i = 0; i < arr.length; i++) {
    arr[i] = i * 5
  }

  // Randomize and insert
  tree = new RBST()
  autoResolve = -1
  for (let i = 0; i < arr.length; i++) {
    const si = Math.floor(Math.random() * (arr.length - i)) + i
    const temp = arr[si]
    arr[si] = arr[i]
    arr[i] = temp

    await tree.put(arr[i])
  }

  console.log(arr)

  autoResolve = 0
  applyHistoryStack([])
  await tree.visualize("Ready")
}


/**
 * Starting an insertion operation on the tree
 * @param {number} newKey key to insert
 */
async function performInsert(newKey) {
  toggleAnimationLock()

  // Save operation for rewind
  lastOp = {
    op: "insert",
    key: newKey,
    tree: tree
  }

  // Create a deep "pilot" copy, which runs through the operation once (no animation) to generate all the key events 
  const pilotCopy = tree.clone()
  autoResolve = -1
  const arr = []
  await pilotCopy.put(newKey, arr)
  await tree.visualize(`Finished Insertion on ${newKey}`, newKey, arr)
  autoResolve = 0

  // Populate the history panel
  applyHistoryStack(arr)

  do {
    if (rewindStep !== -1) {
      // Set up autoresolve this is a rewind
      autoResolve = rewindStep
      rewindStep = -1
    }

    // Use a seperate copy of tree
    tree = lastOp.tree.clone()

    animationStep = -1
    // Perform operation
    await tree.put(newKey)
    await tree.visualize(`Finished Insertion on ${newKey}`)


  } while (rewindStep !== -1)

  toggleAnimationLock()
}

/**
 * If there are currently animations in suspension, immediately finish it
 */
function skipCurrentAnimation() {
  if (!resolvePending) {
    return
  }
  autoResolve = -1
  resolvePending()
}

/**
 * So the conventional way of rewinding (storing state in stack, pop stack as necessacry) doesn't work for our case
 * since the step through uses call stack for state storage, and we can't take snapshots at callstack for rewinding
 * Instead, since every operation is deterministic, the state of the tree is copied before the whole operation.
 * When we rewind, we take note of how many step-forwards the target point is
 * then quickly skip through everything for the current operation, restore the previous copy, 
 * and fast foward as many times as needed
 */

/**
 * Rewind the current operation (or last if it is finished) to a specific step in time
 * @param {number} stepCount number of steps to go to in the current operation
 */
async function handleRewind(stepCount) {
  console.log(stepCount)
  // validate stepcount
  if (stepCount < 0 || stepCount >= $("#historyList").children().length) {
    return
  }

  rewindStep = stepCount
  if (resolvePending) {
    // The operation is still in progress, we can use the suspended performInsert call to do the rewind
    autoResolve = -1
    resolvePending()
  }
  else if (lastOp) {
    // operation has finished, manually start a second identical insert op on the tree copy
    tree = lastOp.tree

    await performInsert(lastOp.key)
  }
}

$(document).ready(async () => {
  // Init Variables
  c = document.getElementById('cv');
  globalCTX = c.getContext("2d");
  globalCTX.canvas.width = visualSettings.canvasX;
  globalCTX.canvas.height = visualSettings.canvasY;
  globalCTX.font = "28px 'Trebuchet MS'";
  globalCTX.textAlign = "center";
  canvasWidth = c.width;
  canvasHeight = c.height;

  c.addEventListener("click", () => {
    if (resolvePending) resolvePending()
  })

  await initTree(30)

  applyHistoryStack([])
})