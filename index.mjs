/*
 * @Author: 王佳宾
 * @Date: 2023-08-15 16:23:59
 * @LastEditors: 王佳宾
 * @LastEditTime: 2023-08-16 14:14:13
 * @Description: 
 * @FilePath: \index.mjs
 */
import * as satellite from 'satellite.js'
import * as fs from 'fs'
import moment from 'moment'
import { JulianDate } from 'cesium'

const setCzmlOribitEntity = (
  [satName, tleLine1, tleLine2],
  beginTime,
  endTime,
  intervalMinute = 3
) => {
  // 卫星飞行一圈的时间(ms)
  const perTime = ((24 * 3600) / Number(tleLine2.substr(52, 11))) * 1000

  // 轨道预测 返回从两行TLE数据导入的卫星。
  const satrec = satellite.twoline2satrec(tleLine1, tleLine2)
  // 3min预测一次
  const intervalMS = intervalMinute * 60 * 1000
  // 设置clock参数
  const startJulian = JulianDate.fromDate(new Date(beginTime))
  const endJulian = JulianDate.fromDate(new Date(endTime))
  const Iso8601Start = JulianDate.toIso8601(startJulian)
  const Iso8601End = JulianDate.toIso8601(endJulian)
  const clockInterval = `${Iso8601Start}/${Iso8601End}`

  let refCartestian = []
  let n = 0
  // 每intervalMS计算一个位置信息，最后采用拉格朗日插值法处理数据
  for (
    let i = new Date(beginTime).valueOf();
    i < new Date(endTime).valueOf();
    i += intervalMS
  ) {
    const date = new Date(i)
    // 返回给定日期和时间的位置和速度向量
    const positionAndVelocity = satellite.propagate(satrec, date)
    const { position } = positionAndVelocity
    refCartestian.push(
      (n * intervalMS) / 1000,
      ...[position.x * 1000, position.y * 1000, position.z * 1000]
    )
    n += 1
  }

  let leadIntervalArray = []
  let trailIntervalArray = []
  // 设置卫星的轨道周期
  for (
    let i = new Date(beginTime).getTime();
    i < new Date(endTime).getTime();
    i += perTime
  ) {
    const curTime = JulianDate.fromDate(new Date(i))
    const nextTime = JulianDate.fromDate(new Date(i + perTime))
    const timeLength = perTime / 1000
    leadIntervalArray.push({
      epoch: JulianDate.toIso8601(curTime),
      interval: `${JulianDate.toIso8601(curTime)}/${JulianDate.toIso8601(
        nextTime
      )}`,
      number: [0, timeLength, timeLength, 0]
    })
    trailIntervalArray.push({
      epoch: JulianDate.toIso8601(curTime),
      interval: `${JulianDate.toIso8601(curTime)}/${JulianDate.toIso8601(
        nextTime
      )}`,
      number: [0, 0, timeLength, timeLength]
    })
  }

  // czml 文件
  let tempCZML = []

  // 设置czml [0] clock --
  tempCZML.push({
    id: 'document',
    name: 'CZML Point - Time Dynamic',
    version: '1.0',
    clock: {
      interval: clockInterval,
      currentTime: Iso8601Start,
      multiplier: 60,
      range: 'LOOP_STOP',
      step: 'SYSTEM_CLOCK_MULTIPLIER'
    }
  })

  // 设置czml [1] position --
  tempCZML.push({
    id: `${satName}`,
    name: `${satName}`,
    // 实体在什么时间范围可用
    availability: clockInterval,
    description: `Orbit of Satellite: ${satName}`,
    label: {
      fillColor: {
        rgba: [255, 0, 255, 255]
      },
      font: '11pt Lucida Console',
      horizontalOrigin: 'LEFT',
      outlineColor: {
        rgba: [0, 0, 0, 255]
      },
      outlineWidth: 2,
      pixelOffset: {
        cartesian2: [12, 0]
      },
      show: true,
      style: 'FILL_AND_OUTLINE',
      text: `${satName}`,
      verticalOrigin: 'CENTER'
    },
    // 决定了卫星的轨迹，包括如何绘制和轨迹数据
    path: {
      show: [
        {
          interval: clockInterval,
          boolean: true
        }
      ],
      width: 3,
      material: {
        solidColor: {
          color: {
            rgba: [
              // 随机生成轨道颜色
              Math.floor(255 * Math.random(0, 1)),
              Math.floor(255 * Math.random(0, 1)),
              Math.floor(255 * Math.random(0, 1)),
              255
            ]
          }
        }
      },
      // 此参数决定如何在两点之间插值
      resolution: 120,
      // 显示路径的动画时间之前的时间（以秒为单位）。 卫星的轨道周期
      leadTime: leadIntervalArray,
      // 动画时间之后的时间（以秒为单位），用于显示 卫星的轨道周期
      trailTime: trailIntervalArray
    },
    model: {
      show: true,
      gltf: '/resource/satellite/weixin.gltf',
      scale: 1,
      minimumPixelSize: 80
    },
    position: {
      // 采用拉格朗日插值法
      interpolationAlgorithm: 'LAGRANGE',
      // 1为线性插值，2为平方插值
      interpolationDegree: 5,
      // 参考坐标系，地惯坐标系
      referenceFrame: 'INERTIAL',
      epoch: `${Iso8601Start}`,
      cartesian: refCartestian
    },
    orientation: {
      // 设置卫星朝向
      velocityReference: `Satellite/${satName}#position`
    }
  })
  return tempCZML
}

// https://celestrak.org/satcat/table-satcat.php?NAME=FENGYUN&PAYLOAD=1&MAX=500 获取二行数
const tles = [
  'JILIN-01-10',
  '1 43946U 19005E   23227.71974566  .00004378  00000+0  24921-3 0  9994',
  '2 43946  97.4971 320.9613 0030792 281.8828  77.8951 15.12961781252015'
]
const tles1 = [
  'JILIN 1',
  '1 40961U 15057D   23227.70172083  .00001082  00000+0  16760-3 0  9995',
  '2 40961  97.7079 263.1579 0018605  34.2629 325.9777 14.74983254422645'
]
// const tles = [
//   'ZIYUAN 1-02C (ZY 1-02C) ',
//   '1 38038U 11079A   23227.75256249  .00000557  00000+0  20565-3 0  9993',
//   '2 38038  98.5395 294.5036 0007265 151.6239 283.0935 14.36300245610374'
// ]
const startTime = moment().subtract(1, 'day').format('YYYY-MM-DD hh:mm:ss')
const endTime = moment().format('YYYY-MM-DD hh:mm:ss')
const czml = setCzmlOribitEntity(tles, startTime, endTime);
const czml1 = setCzmlOribitEntity(tles1, startTime, endTime)

const writeFile = (name, data) => {
  // , { flag: 'a' }
  fs.writeFile(name, JSON.stringify(data), function (err) {
    if (err) {
      throw err
    }
    console.log(`成功写入${name}`)
  })
}
[czml,
czml1].forEach((item, index) => {
    writeFile(`./czml${index}.json`, item)
})
