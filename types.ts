type Property = {
    id: string
    url: string
    address: string 
    price: string 
    property: string 
    summaryInfo: SummaryInfo
    stationInfo: StationInfo
    floorplanArea: string 
}

type SummaryInfo = {
    type: string
    bedrooms?: string
    bathrooms?: string 
    tenure?: string 
    size?: string 
}

type StationInfo = {
    nearestStationName?: string 
    nearestStationDistance?: string 
}

type flattenedProperty = Property & SummaryInfo & StationInfo