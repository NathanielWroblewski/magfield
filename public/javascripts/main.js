import Vector from './models/vector.js'
import FourByFour from './models/four_by_four.js'
import Camera from './models/orthographic.js'
import angles from './isomorphisms/angles.js'
import coordinates from './isomorphisms/coordinates.js'
import renderLine from './views/line.js'
import renderCircle from './views/circle.js'
import renderPolygon from './views/polygon.js'
import { seed, noise } from './utilities/noise.js'
import { stableSort, remap, grid } from './utilities/index.js'
import { COLORS, BLACK, LIGHT_GREY } from './constants/colors.js'
import {
  ZOOM, FPS, Δt, X_AXIS, Z_AXIS, RADIUS, FREQUENCY, r, TIME_THRESHOLD, BLUR
} from './constants/dimensions.js'

// Copyright (c) 2020 Nathaniel Wroblewski
// I am making my contributions/submissions to this project solely in my personal
// capacity and am not conveying any rights to any intellectual property of any
// third parties.

const canvas = document.querySelector('.canvas')
const context = canvas.getContext('2d')

const { sin, cos } = Math

const perspective = FourByFour.identity()
  .rotX(angles.toRadians(45))

const camera = new Camera({
  position: Vector.zeroes(),
  direction: Vector.zeroes(),
  up: Vector.from([0, 1, 0]),
  width: canvas.width,
  height: canvas.height,
  zoom: ZOOM
})

const rad90 = angles.toRadians(90)

const from = Vector.from([20, -90])
const to = Vector.from([60, 90])
const by = Vector.from([5, 5])

const halfΔθ = angles.toRadians(by[0] / 2)
const halfΔφ = angles.toRadians(by[1] / 2)

const faces = grid({ from, to, by }, degrees => {
  const [θ, φ] = degrees.map(angles.toRadians)
  const center = coordinates.toCartesian(Vector.from([r, θ, φ]))

  return {
    type: 'polygon',
    center,
    vertices: [
      Vector.from([r, θ - halfΔθ, φ - halfΔφ]),
      Vector.from([r, θ - halfΔθ, φ + halfΔφ]),
      Vector.from([r, θ + halfΔθ, φ + halfΔφ]),
      Vector.from([r, θ + halfΔθ, φ - halfΔφ]),
    ].map(coordinate => coordinates.toCartesian(coordinate)),
    stroke: BLACK,
    fill: LIGHT_GREY
  }
})

faces.push({
  type: 'circle',
  center: coordinates.toCartesian(Vector.from([r, 0, 0])),
  radius: RADIUS,
  stroke: LIGHT_GREY,
  fill: BLACK
})

const campos = Vector.from([0, 10, 100])

const renderComparator = (a, b) => {
  const a0 = campos.subtract(a.center.transform(perspective))
  const b0 = campos.subtract(b.center.transform(perspective))

  if (a0.z < b0.z) return -1
  if (a0.z > b0.z) return 1
  if (a0.x < b0.x) return -1
  if (a0.x > b0.x) return 1
  if (a0.y < b0.y) return -1
  if (a0.y > b0.y) return 1
  return 0
}

const render = () => {
  context.clearRect(0, 0, canvas.width, canvas.height)

  perspective.rotZ(angles.toRadians(0.2))

  stableSort(faces, renderComparator).forEach(({ type, vertices, center, radius, stroke, fill }) => {
    let projected;

    switch (type) {
      case 'polygon':
        const angle = remap(noise(center.y * FREQUENCY, center.z * FREQUENCY, time), [-1, 1], [-360, 360])
        const radians = angles.toRadians(angle)
        const φ = coordinates.toSpherical(center).φ
        const rotatedCenter = center.rotateAround(Vector.zeroes(), Z_AXIS, -φ + rad90)
        const colorIndex = Math.floor(remap(angle, [-360, 360], [0, COLORS.length - 1]))
        const color = COLORS[colorIndex]

        context.shadowBlur = 0

        projected = vertices.map(vertex => {
          return camera.project(
            vertex
              .rotateAround(Vector.zeroes(), Z_AXIS, -φ + rad90)
              .rotateAround(rotatedCenter, [1, 0, 0], radians)
              .rotateAround(Vector.zeroes(), Z_AXIS, -(-φ + rad90))
              .transform(perspective)
          )
        })

        return renderPolygon(context, projected, stroke, color, 2)
      case 'circle':
        projected = camera.project(center.transform(perspective))

        context.shadowBlur = BLUR
        context.shadowColor = LIGHT_GREY

        return renderCircle(context, projected, radius, stroke, fill)
    }
  })

  time += Δt
  if (time > TIME_THRESHOLD) time = 0
}

seed(Math.random())

let prevTick = 0
let time = 0

const step = () => {
  window.requestAnimationFrame(step)

  const now = Math.round(FPS * Date.now() / 1000)
  if (now === prevTick) return
  prevTick = now

  render()
}

step()
