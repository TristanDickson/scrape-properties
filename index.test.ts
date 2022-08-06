
import puppeteer from "puppeteer";
import getSummaryInfo from "./summary";

test('Gets summary info', async () => {
    const url = "https://www.rightmove.co.uk/properties/124431986#/?channel=RES_BUY"
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    try {
        await getSummaryInfo(page)
    }
    catch (error) {
        console.log(error)
        browser.close()
    }

    browser.close()
});