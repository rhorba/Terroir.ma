/**
 * Morocco-specific data structures.
 */

export type MoroccoLanguage = 'ar-MA' | 'fr-MA' | 'zgh';

export type MoroccoRegionCode =
  | 'TANGER_TETOUAN_AL_HOCEIMA'
  | 'ORIENTAL'
  | 'FES_MEKNES'
  | 'RABAT_SALE_KENITRA'
  | 'BENI_MELLAL_KHENIFRA'
  | 'CASABLANCA_SETTAT'
  | 'MARRAKECH_SAFI'
  | 'DRAA_TAFILALET'
  | 'SOUSS_MASSA'
  | 'GUELMIM_OUED_NOUN'
  | 'LAAYOUNE_SAKIA_EL_HAMRA'
  | 'DAKHLA_OUED_ED_DAHAB';

export type CertificationType = 'IGP' | 'AOP' | 'LABEL_AGRICOLE';

export interface LocalizedText {
  ar: string;
  fr: string;
  zgh?: string;
}

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
}
