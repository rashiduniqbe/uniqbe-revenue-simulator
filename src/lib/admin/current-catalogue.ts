import catalogueData from "../../data/catalogue.json";
import { Catalogue } from "../schemas";

/** The catalogue bundled with this deployment, which an upload is diffed against. */
export const CURRENT_CATALOGUE = Catalogue.parse(catalogueData);
