// This document has updated from anilkpatro/ThingSpeak Graph.js

// THINGSPEAK
// https://thingspeak.com/

// Get widget parameters or set up it with default parameters
let widgetInputRAW = args.widgetParameter || "2738067|1|results=50|6VBXCSIF3MUSAHMB"; 

try {
	widgetInputRAW.toString();
} catch(e) {
	throw new Error("Please long press the widget and add a parameter. Eg: 2738067|1|results=50|6VBXCSIF3MUSAHMB");
}

var widgetInput = widgetInputRAW.toString();

// Parse the parameters
var inputArr = widgetInput.split("|");

// The size of the widget preview in the app - "small", "medium" or "large"
const widgetPreview = "small";

// Widget Settings
const thingSpeakSettings = {  
  
  // ThingSpeak channel
  channelId: inputArr[0],
  
  // ThingSpeak field from channel
  fieldId: inputArr[1],
  
  // Query parameters
  queryParams: inputArr[2],

  // Read_API_Keys parameters
  readKey: inputArr[3],

  // Show the created time
  showCreated: true,

};


// Chart settings
const chartSettings = {
  color: "#8cf5f3",
  
  opacity: 0.6,
};


// LineChart by https://kevinkub.de/
// Used as the widget background
class LineChart {
  constructor(width, height, values) {
    this.ctx = new DrawContext();
    this.ctx.size = new Size(width, height);
    this.values = values;
  }

  _calculatePath() {
    let maxValue = Math.max(...this.values);
    let minValue = Math.min(...this.values);
    let difference = maxValue - minValue;
    let count = this.values.length;
    let step = this.ctx.size.width / (count - 1);
    let points = this.values.map((current, index, all) => {
      let x = step * index;
      let y = this.ctx.size.height - (current - minValue) / difference * (this.ctx.size.height * 0.5);
      return new Point(x, y);
    });
    return this._getSmoothPath(points);
  }

  _getSmoothPath(points) {
    let path = new Path();
    path.move(new Point(0, this.ctx.size.height));
    path.addLine(points[0]);
    for (let i = 0; i < points.length - 1; i++) {
      let xAvg = (points[i].x + points[i + 1].x) / 2;
      let yAvg = (points[i].y + points[i + 1].y) / 2;
      let avg = new Point(xAvg, yAvg);
      let cp1 = new Point((xAvg + points[i].x) / 2, points[i].y);
      let next = new Point(points[i + 1].x, points[i + 1].y);
      let cp2 = new Point((xAvg + points[i + 1].x) / 2, points[i + 1].y);
      path.addQuadCurve(avg, cp1);
      path.addQuadCurve(next, cp2);
    }
    path.addLine(new Point(this.ctx.size.width, this.ctx.size.height));
    path.closeSubpath();
    return path;
  }

  configure(fn) {
    let path = this._calculatePath();
    if (fn) {
      fn(this.ctx, path);
    } else {
      this.ctx.addPath(path);
      this.ctx.fillPath(path);
    }
    return this.ctx;
  }

}


async function run() {
  let widget = new ListWidget();
  widget.setPadding(15, 15, 15, 15);
  widget.backgroundColor = new Color("#fff7f2")

  const channel = thingSpeakSettings.channelId;  
  const field = thingSpeakSettings.fieldId;
  const query = thingSpeakSettings.queryParams;
  const readKey = thingSpeakSettings.readKey;
  
  widget.url = "https://thingspeak.com/channels/" + channel

  const thingSpeakJson = await getThingSpeakData(channel, field, query, readKey);
  const thingSpeakData = thingSpeakJson.feeds;
  const channelName = thingSpeakJson.channel.name;  
  const fieldName = thingSpeakJson.channel["field"+field];  

  let chartData = getCountsFromData(thingSpeakData, field);

  const chartColor = chartSettings.color;
  const chartOpacity = chartSettings.opacity;
  
  let width = 1200;
  let height = 1200;
  if (widgetPreview === "medium") {
    height = 600;
  }

  // Line chart as bg
  // This will create a square chart
  let chart = new LineChart(width, height, chartData).configure((ctx, path) => {
    ctx.opaque = false;
    ctx.setFillColor(new Color(chartColor, chartOpacity));
    ctx.addPath(path);
    ctx.fillPath(path);
  }).getImage();
  widget.backgroundImage = chart;

  const textColor = Color.black();

  const header = widget.addText(channelName.toUpperCase());
  header.textColor = textColor;
  header.font = Font.regularSystemFont(12);
  header.minimumScaleFactor = 0.50;
  
  widget.addSpacer(5);
  
  const subheader = widget.addText(fieldName);
  subheader.textColor = textColor;
  subheader.font = Font.regularSystemFont(12);
  subheader.minimumScaleFactor = 0.50;
  
  const recentIndex = thingSpeakData.length-1;
  const recentValue = chartData[recentIndex];

  const valuetext = widget.addText(recentValue.toLocaleString(undefined,
      { maximumFractionDigits: 2,
        minimumFractionDigits: 0
        }));
  valuetext.textColor = textColor;
  valuetext.font = Font.semiboldSystemFont(30);
  valuetext.minimumScaleFactor = 0.3;

  widget.addSpacer(5);

  if (thingSpeakSettings.showCreated) {
    const createdAt = new Date(thingSpeakData[recentIndex].created_at).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
    const widgetText = widget.addText(`At ${createdAt}`);
    widgetText.textColor = textColor;
    widgetText.font = Font.regularSystemFont(9);
    widgetText.minimumScaleFactor = 0.6;
  }
  
  widget.addSpacer();

  Script.setWidget(widget);
  if (config.runsInApp) {
    if (widgetPreview === "small") { widget.presentSmall(); }
    else if (widgetPreview === "medium") { widget.presentMedium(); }
    else if (widgetPreview === "large") { widget.presentLarge(); }
  }
  Script.complete();
}

/**
 * Fetch ThingSpeak data
 * 
 * @param {string} channel
 * @param {string} field
 * @param {string} query
 * @param {string} key parameter
 * @returns {Promise<ThingSpeakJson>}
 */
async function getThingSpeakData(channel, field, query, key) {
  const req = "https://api.thingspeak.com/channels/" + channel + "/fields/" + field + ".json?" + "api_key=" + key + "&" + query;  

  let json = await new Request(req).loadJSON();
  return json;
}

// Convert API data into a simple list
function getCountsFromData(feeds, field) {
  let chartValues = []
  for(let data in feeds) {
    let feed = feeds[data];
    let val = parseFloat(feed["field" + field]);
    chartValues.push(val);
  }
  return chartValues;  
}


await run();
