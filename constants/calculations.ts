/** Collection path for saved loan calculations. */
export const CALCULATIONS_PATH = "/loan-calculations";

export const CALCULATION_NAME_MAX_LENGTH = 120;

export const CALCULATION_DESCRIPTION_MAX_LENGTH = 2000;

/**
 * The dropdown has no pager, so it asks for the largest page the API allows in
 * one request rather than stitching several together. The API caps how many
 * calculations a user may save, which is what keeps that page sufficient.
 */
export const CALCULATIONS_LIST_LIMIT = 100;