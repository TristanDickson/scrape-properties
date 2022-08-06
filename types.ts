type Property = {
    id: string
    url: string
    address: string | null
    price: string | null
    property: string | null
    summaryInfo: SummaryInfo
    stationInfo: StationInfo
    floorplanArea: string | null
}

type SummaryInfo = {
    type?: string | null
    bedrooms?: string | null
    bathrooms?: string | null
    tenure?: string | null
    size?: string | null
}

type StationInfo = {
    nearestStationName?: string | null
    nearestStationDistance?: string | null
}

type flattenedProperty = Property & SummaryInfo & StationInfo