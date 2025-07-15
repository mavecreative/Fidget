let vid
let distanceSlider
let spotlights = []
let overlayLayer
let glitchLayer
let videoReady = false
let lightLeaks = []
let particles = []

let serial // variable for the serial object
let latestData = "waiting for data" // variable to hold the data

let multiPlayer, button1, button2, button3, button4, stopButton
let vol

let startButton

function preload () {
  vid = createVideo(['eyes-color.mp4'])
  vid.hide()
  
  multiPlayer = new Tone.Players({ //We need to open up the object and specify the file pathway/URL for every sound file we want, as well as give it a name using JSON.
    whisp1: "whisper.mp3",
    whisp2: "eerie1.wav",
  }).toDestination()

  multiPlayer.player("whisp2").loop = true
  multiPlayer.player("whisp1").loop = true
}

function setup () {
  createCanvas(windowWidth, windowHeight)
  
  // serial constructor
    serial = new p5.SerialPort()

    // serial port to use - you'll need to change this
    serial.open("COM28")

    // what to do when we get serial data
    serial.on('data', gotData)

  vid.elt.onloadedmetadata = () => {
    vid.loop()
    vid.volume(0)
    vid.play()

    overlayLayer = createGraphics(height, width) // Swap dimensions for 90° rotation
    glitchLayer = createGraphics(height, width)

    for (let i = 0; i < 3; i++) lightLeaks.push(new LightLeak())
    for (let i = 0; i < 80; i++) particles.push(new Particle())

    videoReady = true
  }
  
  startButton = createButton('Submit')
  startButton.style('background-color', 'black')
  startButton.position(0, 0)
  startButton.size(width, height)
  startButton.style('font-size', '12px')
  startButton.mousePressed(startAudio)
}

async function startAudio () {
  await Tone.start()

  multiPlayer.player('whisp1').start()
  multiPlayer.player('whisp1').volume.value = 8

  multiPlayer.player('whisp2').start()
  multiPlayer.player('whisp2').volume.value = -50

  startButton.hide()
}

function gotData() {
  let currentString = serial.readLine() // store the data in a variable
  trim(currentString) // get rid of whitespace
  if (!currentString) return; // if there's nothing in there, ignore it
  //console.log(currentString) // print it out
  latestData = currentString // save it to the global variable
}

function draw () {
  if (!videoReady) {
    background(0)
    fill(255)
    textAlign(CENTER, CENTER)
    text('Loading video...', width / 2, height / 2)
    return
  }

  background(0)

  // Distance for spotlight logic
  let distance = remapRangeEye(latestData); // DISTANCE IS THE VALUE YOU ARE CHANGING BASED ON THE SENSOR DATA (GOES BETWEEN 0 = CLOSEST, 1 = FARTHEST)

  let targetCount = floor(map(distance, 1, 0, 5, 15))
  while (spotlights.length < targetCount)
    spotlights.push(new Spotlight(spotlights.length))
  while (spotlights.length > targetCount) spotlights.pop()

  overlayLayer.clear()
  overlayLayer.background(0)
  overlayLayer.erase()

  for (let spotlight of spotlights) {
    spotlight.update(distance)
    spotlight.draw(overlayLayer)
  }

  overlayLayer.noErase()

  drawGlitchOverlay()

  // Draw video + overlays rotated 90° clockwise
  push()
  translate(width, 0)
  rotate(HALF_PI)
  image(vid, 0, 0, height, width) // Swap width & height for rotated draw
  image(overlayLayer, 0, 0)
  image(glitchLayer, 0, 0)
  pop()
    
  vol=latestData*0.1;
  //console.log(vol);

  multiPlayer.player("whisp1").volume.value = (remapRangeVol(latestData)*0.15)-12;
  multiPlayer.player("whisp2").volume.value = vol-13;
}

function windowResized () {
  resizeCanvas(windowWidth, windowHeight)
  overlayLayer = createGraphics(height, width) // Respect rotation
  glitchLayer = createGraphics(height, width)
}
  
 // Remaps data between 0-1 to mimic slider values
function remapRangeEye(value) {
  // Ensure value is a number before constraining and mapping
  if (isNaN(value)) {
    console.log("Warning: NaN value passed to remapRangeEye");
    return 0; // Return default value
  }
  
  value = constrain(value, 2, 150); // p5.js constrain function
  return map(value, 5, 150, -0.2, 1.2);
}

// Remaps incoming data to have an inverse relationship
function remapRangeVol(value) {
  // Ensure value is a number before constraining and mapping
  if (isNaN(value)) {
    console.log("Warning: NaN value passed to remapRangeVol");
    return 0; // Return default value
  }
  
  value = constrain(value, 2, 140); // p5.js constrain function
  return map(value, 5, 140, 140, 5);
}

// === Spotlight class ===
class Spotlight {
  constructor (index) {
    this.pos = createVector(random(height), random(width))
    this.target = createVector(random(height), random(width))
    this.baseSize = 100
    this.speed = 0.02
    this.phaseOffset = random(TWO_PI)
  }

  update (distance) {
    const maxSize = height + 1
    const minSize = height / 12
    this.baseSize = map(distance, 1, 0, minSize, maxSize)

    this.speed = map(distance, 1, 0, 0.01, 0.2)
    this.pos.lerp(this.target, this.speed)

    if (p5.Vector.dist(this.pos, this.target) < 5) {
      this.target = createVector(random(height), random(width))
    }

    this.blinkFrequency = map(distance, 1, 0, 0.5, 3)
  }

  draw (pg) {
    let time = millis() / 1000
    let blink = abs(sin(TWO_PI * this.blinkFrequency * time + this.phaseOffset))
    let blinkSize = this.baseSize * blink
    pg.rectMode(CENTER)
    pg.rect(this.pos.x, this.pos.y, blinkSize, blinkSize)
  }
}

// === Glitch shimmer overlay with light leaks and particles ===
function drawGlitchOverlay () {
  glitchLayer.clear()
  glitchLayer.noStroke()

  let shimmerStrength = 25
  let flickerCol1 = color(255, 180, 255, shimmerStrength)
  let flickerCol2 = color(180, 240, 255, shimmerStrength)
  let pulse = sin(millis() * 0.002) * 0.5 + 0.5

  glitchLayer.fill(lerpColor(flickerCol1, flickerCol2, pulse))
  glitchLayer.rect(0, 0, height, width)

  for (let i = 0; i < 12; i++) {
    let y = noise(i, millis() * 0.001) * width
    let h = random(2, 4)
    glitchLayer.fill(255, 220, 255, 30)
    glitchLayer.rect(0, y, height, h)
  }

  for (let i = 0; i < 40; i++) {
    let y = random(width)
    glitchLayer.stroke(255, 200, 255, random(10, 20))
    glitchLayer.line(0, y, height, y)
  }

  for (let i = 0; i < 300; i++) {
    let x = random(height)
    let y = random(width)
    let alpha = random(20, 50)
    let c = lerpColor(
      color(255, 200, 255),
      color(180, 255, 255),
      noise(x * 0.01, y * 0.01, millis() * 0.0003)
    )
    glitchLayer.fill(c.levels[0], c.levels[1], c.levels[2], alpha)
    glitchLayer.ellipse(x, y, random(1, 3))
  }

  for (let leak of lightLeaks) {
    leak.update()
    leak.display(glitchLayer)
  }

  for (let p of particles) {
    p.update()
    p.display(glitchLayer)
  }
}

// === Band-style Light Leak ===
class LightLeak {
  constructor () {
    this.reset()
  }

  reset () {
    this.orientation = random() > 0.5 ? 'horizontal' : 'vertical'
    this.pos = createVector(random(height), random(width))
    this.length = this.orientation === 'horizontal' ? height : width
    this.thickness = random(width / 5, width / 2)
    this.alpha = random(20, 40)
    this.baseAlpha = this.alpha
    this.color = lerpColor(color(255, 180, 255), color(180, 255, 255), random())
    this.velocity =
      this.orientation === 'horizontal'
        ? createVector(0, random(-0.5, 0.5))
        : createVector(random(-0.5, 0.5), 0)
    this.noiseOffset = random(1000)
  }

  update () {
    this.pos.add(this.velocity)
    this.alpha =
      this.baseAlpha * (0.5 + 0.5 * noise(this.noiseOffset + millis() * 0.0005))
    if (
      this.pos.x < -this.length ||
      this.pos.x > height + this.length ||
      this.pos.y < -this.thickness ||
      this.pos.y > width + this.thickness
    ) {
      this.reset()
    }
  }

  display (pg) {
    pg.noStroke()
    for (let i = 0; i < 3; i++) {
      let flickerAlpha = this.alpha + random(-5, 5)
      pg.fill(
        this.color.levels[0],
        this.color.levels[1],
        this.color.levels[2],
        flickerAlpha
      )

      if (this.orientation === 'horizontal') {
        pg.rect(
          0,
          this.pos.y + random(-2, 2),
          height,
          this.thickness * noise(i + millis() * 0.001)
        )
      } else {
        pg.rect(
          this.pos.x + random(-2, 2),
          0,
          this.thickness * noise(i + millis() * 0.001),
          width
        )
      }
    }
  }
}

// === Floating Particle Class ===
class Particle {
  constructor () {
    this.pos = createVector(random(height), random(width))
    this.vel = p5.Vector.random2D().mult(random(0.1, 0.3))
    this.size = random(1, 4)
    this.alpha = random(30, 80)
    this.color = lerpColor(color(255, 200, 255), color(180, 255, 255), random())
  }

  update () {
    this.pos.add(this.vel)
    if (this.pos.x < 0 || this.pos.x > height) this.vel.x *= -1
    if (this.pos.y < 0 || this.pos.y > width) this.vel.y *= -1
  }

  display (pg) {
    pg.noStroke()
    pg.fill(
      this.color.levels[0],
      this.color.levels[1],
      this.color.levels[2],
      this.alpha
    )
    pg.ellipse(this.pos.x, this.pos.y, this.size)
  }
}
