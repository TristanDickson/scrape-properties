import Axios from 'axios';
import fs from 'fs';
import puppeteer, { Page } from "puppeteer";
import "reflect-metadata";
import tesseract from "node-tesseract-ocr";
import getSummaryInfo from './summary';

async function downloadImage(url: string, filepath: string) {
  const response = await Axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  return new Promise((resolve, reject) => {
    response.data.pipe(fs.createWriteStream(filepath))
      .on('error', reject)
      .once('close', () => resolve(filepath));
  });
}

async function getPropertyInfo(page: Page, property: Property) {
  await page.goto(property.url);
  // Key Info
  property.address = await page.$eval('h1[itemprop="streetAddress"]', el => el.textContent)
  property.price = await page.$eval('div[data-skip-to-content] article div[style] span', el => el.textContent)
  // Summary Info
  property.summaryInfo = await getSummaryInfo(page)
  // Station Info
  const stationInfoHTML = await page.$$('#Stations-panel li span')
  const stationInfoKeys = ['nearestStationName', 'nearestStationDistance']
  let stationInfo: any = {}
  for (let i = 0; i < stationInfoKeys.length; i++) {
    stationInfo[stationInfoKeys[i]] = await stationInfoHTML[i].evaluate(el => el.innerHTML)
  }
  property.stationInfo = stationInfo
}

async function getFloorplanArea(page: Page, url: string, filename: string): Promise<string | null> {
  let text = ''

  await page.goto(url);
  const image = await page.$('[alt^="Floorplan"]');
  if (image) {
    const imageURL = await page.evaluate(el => el.getAttribute("src"), image);
    if (imageURL) {
      await downloadImage(imageURL, filename)

      try {
        console.log("trying to process image")
        let text = await tesseract.recognize(
          filename,
          {
            lang: "eng",
            oem: 3,
            psm: 6,
          }
        )
        const match = text.match(/((([4-9]\d)|(\d{3}))\.\d{1,2}) (sq|SQ)[\s\.]*(m|M|metres|METRES)/)
        if (match) {
          return match[1];
        }
      }
      catch {
        return text
      }
    }
  }
  return text
}

function flattenObject(json: any, newJson: any = {}) {
  Object.entries(json).forEach(([key, value]) => {
    if (typeof value === 'object') {
      flattenObject(value, newJson)
    }
    else {
      newJson[key] = value
    }
  })
  return newJson
}

function outputToCSV(properties: Property[]) {
  let writeStream = fs.createWriteStream("out.csv", "utf-8")
  let flattenedProperties = properties.map(property => flattenObject(property))
  // Write headers
  let headers = ""
  Object.keys(flattenedProperties[0]).forEach(key =>
    headers += `"${key}",`
  )
  headers = headers.slice(0, -1)
  writeStream.write(`${headers}\n`)

  // Write content
  flattenedProperties.forEach(property => {
    let csvLine = ""
    Object.values(property).forEach(value => {
      csvLine += `"${value}",`
    })
    csvLine = csvLine.slice(0, -1)

    writeStream.write(`${csvLine}\n`)
  })
}

function createProperty(url: string): Property {
  return {
    id: url?.split("/")[4].slice(0, -1),
    url: url,
    address: "",
    price: "",
    property: "",
    floorplanArea: "",
    summaryInfo: {
      type: "",
      bedrooms: "",
      bathrooms: "",
      tenure: "",
      size: ""
    },
    stationInfo: {
      nearestStationName: "",
      nearestStationDistance: ""
    },
  }
}

async function getProperty(url: string, page: Page) {
  await page.goto(url);

  let property = createProperty(url);
  await getPropertyInfo(page, property);
  const floorplanURL = `https://rightmove.co.uk/properties/${property.id}#/floorplan?activePlan=1&channel=RES_BUY`;
  const filename = `floorplans/floorplan-${property.id}.jpeg`;
  property.floorplanArea = await getFloorplanArea(page, floorplanURL, filename)

  return property
}

async function getProperties(url: string, page: Page) {
  let properties: Property[] = []

  await page.goto(url);
  // await page.screenshot({ path: 'example.png' });

  const resultCount = await page.$eval('span[data-bind="counter: resultCount, formatter: numberFormatter"]', el => el.textContent)
  console.log(`Total results: ${resultCount}`)
  const pagesText = await page.$eval('span[data-bind="text: total"]', el => el.textContent)
  const pages = pagesText ? parseInt(pagesText) : null
  if (pages) {
    console.log(`Total Pages: ${pages}\n`)
    for (let p = 0; p < pages; p++) {
      await page.goto(`${url}&index=${p * 24}`);
      const paths = await page.$$eval(
        '.propertyCard:not(.propertyCard--featured) .propertyCard-priceLink',
        els => els.map(el => el.getAttribute('href'))
      );
      for (let i = 0; i < paths.length; i++) {
        const relativePath = paths[i];
        if (relativePath) {
          console.log(`Parsing property number ${p * 24 + i + 1} of ${resultCount}`)
          let propertyURL = `https://rightmove.co.uk${relativePath}`;
          let property = await getProperty(propertyURL, page)

          properties.push(property)
          console.log(property)
          console.log(flattenObject(property))
        }
      }
    }
  }

  outputToCSV(properties);
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const location = "REGION%5E1127"
  const dontShow = "retirement,sharedOwnership"
  const sortType = 1
  const url = [
    `https://www.rightmove.co.uk/property-for-sale/find.html?`,
    `locationIdentifier=${location}`,
    `&dontShow=${dontShow}`,
    `&sortType=${sortType}`
  ].join("");
  console.log(url);
  await getProperties(url, page);

  // let property = await getProperty("https://www.rightmove.co.uk/properties/124723349#/?channel=RES_BUY", page)
  // console.log(property)

  await browser.close();
})();

