import { Page } from "puppeteer";

type summaryInfoKey = keyof SummaryInfo

const summaryInfoMap: { [key: string]: summaryInfoKey } = {
    "PROPERTY TYPE": "type",
    "BEDROOMS": "bedrooms",
    "BATHROOMS": "bathrooms",
    "TENURE": "tenure",
    "SIZE": "size"
}

export default async function getSummaryInfo(page: Page) {
    const infoItemLabelClass = await page.$eval('div[data-test="infoReel"] > div > div > div', node => node.className)
    const summaryInfo = await page.$$eval('div[data-test="infoReel"] > div', (nodes, infoItemClass, summaryInfoMap) => {
        let summaryInfo: { [key in keyof SummaryInfo]: string } = {
            "type": "",
            "bedrooms": "",
            "bathrooms": "",
            "tenure": "",
            "size": "",
        }
        nodes.forEach(node => {
            let label = node.querySelector(`.${infoItemClass}`)?.textContent
            let value = node.querySelector('p')?.textContent
            if (label && value && Object.keys(summaryInfoMap).includes(label)) {
                let key = summaryInfoMap[label] as keyof SummaryInfo
                summaryInfo[key] = value
            }
        })
        return summaryInfo
    }, infoItemLabelClass, summaryInfoMap)
    return summaryInfo
}