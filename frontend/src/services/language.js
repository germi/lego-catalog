import { processLabels } from "./apiFactory";
import { externalApi, googleSheetsApi } from "./apis";
import { sheetUrls } from "./languageSheetUrls";

const urls = {
  labels: "/labels-hierarchy?language=",
  postLabels: "/labels-import?language=en",
};

export default {
  async getLabels(params) {
    const locale = params?.locale || Object.keys(sheetUrls)[0];
    return await externalApi(urls.labels + locale, (data) =>
      processLabels(data, locale),
    );
  },

  async postLabels(_, __, data) {
    return await externalApi(urls.postLabels, undefined, "post", false, data);
  },

  async getLabelsFromGSheets() {
    const entries = await Promise.all(
      Object.entries(sheetUrls).map(async ([lang, url]) => [lang, await googleSheetsApi(url)]),
    );
    return Object.fromEntries(entries);
  },
};
