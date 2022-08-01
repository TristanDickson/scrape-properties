import Axios from 'axios';
import fs from 'fs';
import puppeteer, { Page } from "puppeteer";
import "reflect-metadata";
import Tesseract from 'tesseract.js';

const url =
  "https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=REGION%5E603&minBedrooms=3&maxPrice=375000&radius=20.0&sortType=1&propertyTypes=detached%2Csemi-detached%2Cterraced&primaryDisplayPropertyType=houses&includeSSTC=false&mustHave=&dontShow=retirement%2CsharedOwnership&furnishTypes=&keywords=";

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

async function getSummary(page: Page, url: string) {
  await page.goto(url);
  // Key Info
  const address = await page.$eval('h1[itemprop="streetAddress"]', el => el.textContent)
  console.log(`Address: ${address}`)
  const price = await page.$eval('div[data-skip-to-content] article div[style] span', el => el.textContent)
  console.log(`Price: ${price}`)
  // Summary Info
  const infoReel = await page.$$('div[data-test="infoReel"] p')
  const infoReelKeys = ['Property Type', 'Bedrooms', 'Bathrooms', 'Tenure']
  for (let i = 0; i < infoReel.length; i++) {
    let value = await infoReel[i].evaluate(el => el.innerHTML)
    console.log(`${infoReelKeys[i]}: ${value}`)
  }
  // Station Info
  const stationInfo = await page.$$('#Stations-panel li span')
  const stationInfoKeys = ['Nearest Station Name', 'Nearest Station Distance']
  for (let i = 0; i < stationInfoKeys.length; i++) {
    let value = await stationInfo[i].evaluate(el => el.innerHTML)
    console.log(`${stationInfoKeys[i]}: ${value}`)
  }
}

async function getFloorplan(page: Page, url: string, filename: string) {
  await page.goto(url);
  const image = await page.$('[alt^="Floorplan"]');
  if (image) {
    const imageURL = await page.evaluate(el => el.getAttribute("src"), image);
    console.log(`Image url: ${imageURL}`);
    if (imageURL) {
      await downloadImage(imageURL, filename)

      let result = await Tesseract.recognize(
        filename,
        'eng'
      )
      let text = result.data.text;

      // console.log(text)
      const match = text.match(/((([5-9]\d)|(\d{3}))\.\d{1,2}) (sq|SQ)[\s\.]*(m|M|metres|METRES)/)
      console.log(match ? match[1] : "No match");
    }
  }
}

async function main() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  // await page.screenshot({ path: 'example.png' });
  const resultCount = await page.$eval('span[data-bind="counter: resultCount, formatter: numberFormatter"]', el => el.textContent)
  console.log(resultCount)
  const pagesText = await page.$eval('span[data-bind="text: total"]', el => el.textContent)
  const pages = pagesText ? parseInt(pagesText) : null
  if (pages) {
    console.log(`Total Pages: ${pages}`)
    for (let p = 0; p < pages; p++) {
      await page.goto(`${url}&index=${p * 24}`);
      const paths = await page.$$eval(
        '.propertyCard:not(.propertyCard--featured) .propertyCard-priceLink',
        els => els.map(el => el.getAttribute('href'))
      );
      for (let i = 0; i < paths.length; i++) {
        const relativePath = paths[i];
        if (relativePath) {
          const propertyURL = `https://rightmove.co.uk${relativePath}`;
          console.log(`\nParsing property number ${p * 24 + i + 1} of ${resultCount}`)
          console.log(`\nProperty url: ${propertyURL}`);
          const propertyID = relativePath?.split("/")[2].slice(0, -1);
          await getSummary(page, propertyURL);
          console.log(`Property ID: ${propertyID}`)
          const floorplanURL = `https://rightmove.co.uk/properties/${propertyID}#/floorplan?activePlan=1&channel=RES_BUY`;
          const filename = `floorplan-${propertyID}.jpeg`;
          console.log(`Floorplan url: ${floorplanURL}`);
          await getFloorplan(page, floorplanURL, filename)
        }
      }
    }
  }

  await browser.close();
}

(async () => {
  await main();
})();

