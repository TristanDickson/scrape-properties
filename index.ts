import puppeteer from "puppeteer";
import fs from 'fs';
import Axios from 'axios';
import Tesseract from 'tesseract.js';

const url =
  "https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=REGION%5E603&minBedrooms=3&maxPrice=375000&radius=20.0&propertyTypes=detached%2Csemi-detached%2Cterraced&primaryDisplayPropertyType=houses&includeSSTC=false&mustHave=&dontShow=retirement%2CsharedOwnership&furnishTypes=&keywords=";

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

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  const cards = await page.$$(".propertyCard-link");
  const path = await page.evaluate(el => el.getAttribute('href'), cards[6])
  if (path) {
    const split = path?.split("/")
    const filename = `floorplan-${split[2]}.jpeg`
    const floorplanURL = `https://rightmove.co.uk/${split[1]}/${split[2]}/floorplan?activePlan=1&channel=RES_BUY`
    console.log(floorplanURL)
    await page.goto(floorplanURL);
    await page.screenshot({ path: 'example.png' });
    const image = await page.$('[alt^="Floorplan"]');
    if (image) {
      const imageLink = await page.evaluate(el => el.getAttribute("src"), image)
      console.log(imageLink)
      if (imageLink) {
        await downloadImage(imageLink, filename)

        let result = await Tesseract.recognize(
          filename,
          'eng'
        )
        let text = result.data.text

        // console.log(text)
        const match = text.match(/((([5-9]\d)|(\d{3}))\.\d{1,2}) (sq|SQ)[\s\.]*(m|M|metres|METRES)/)
        console.log(match ? match[1] : "No match");
      }
    }
  }

  await browser.close();
})();

