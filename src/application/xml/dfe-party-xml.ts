import { EfaturaValidationError } from '../../domain/errors';
import type { AddressData } from '../../domain/value-objects/address-data';
import type { ContactsData } from '../../domain/value-objects/contacts-data';
import type { PartyData, TaxIdData } from '../../domain/value-objects/party-data';
import { element, escapeAttribute, escapeXml, requiredValue } from './xml-core';

export function assertEmitter(emitter: PartyData): void {
  if (!emitter.address) {
    throw new EfaturaValidationError(
      'emitter.address',
      'Emitter address is required for e-Fatura v11.0 XML.',
      'xml.emitter_address_required',
    );
  }

  if (!emitter.contacts?.email) {
    throw new EfaturaValidationError(
      'emitter.contacts.email',
      'Emitter email is required for e-Fatura v11.0 XML.',
      'xml.emitter_email_required',
    );
  }

  if (!emitter.contacts.telephone && !emitter.contacts.mobilephone) {
    throw new EfaturaValidationError(
      'emitter.contacts.telephone',
      'Emitter telephone or mobilephone is required for e-Fatura v11.0 XML.',
      'xml.emitter_phone_required',
    );
  }
}

export function partyXml(name: string, party: PartyData): string {
  if (party.reference) {
    return `<${name}>${element('Reference', party.reference)}</${name}>`;
  }

  return `<${name}>${taxIdXml(requiredValue(party.taxId, `${name}.taxId`))}${element(
    'Name',
    requiredValue(party.name, `${name}.name`),
  )}${addressXml(party.address)}${contactsXml(party.contacts)}</${name}>`;
}

export function optionalPartyXml(name: string, party: PartyData | null): string {
  return party ? partyXml(name, party) : '';
}

export function addressXml(address: AddressData | null): string {
  if (!address) {
    return '';
  }

  return `<Address CountryCode="${escapeAttribute(address.countryCode)}">${element(
    'State',
    address.state,
  )}${element('City', address.city)}${element('Region', address.region)}${element(
    'Street',
    address.street,
  )}${element('StreetDetail', address.streetDetail)}${element(
    'BuildingName',
    address.buildingName,
  )}${element('BuildingNumber', address.buildingNumber)}${element(
    'BuildingFloor',
    address.buildingFloor,
  )}${element('PostalCode', address.postalCode)}${element(
    'AddressDetail',
    address.addressDetail,
  )}${element('AddressCode', address.addressCode)}</Address>`;
}

function taxIdXml(taxId: TaxIdData): string {
  return `<TaxId CountryCode="${escapeAttribute(taxId.countryCode)}">${escapeXml(taxId.value)}</TaxId>`;
}

function contactsXml(contacts: ContactsData | null): string {
  if (!contacts) {
    return '';
  }

  return `<Contacts>${element('Telephone', contacts.telephone)}${element(
    'Mobilephone',
    contacts.mobilephone,
  )}${element('Telefax', contacts.telefax)}${element('Email', contacts.email)}${element(
    'Website',
    contacts.website,
  )}</Contacts>`;
}
