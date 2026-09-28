import type { Dictionary } from '..';
import common from './common';
import shell from './shell';
import auth from './auth';
import modules from './modules';
import emails from './emails';
import org from './org';
import business from './business';
import client from './client';
import documents from './documents';
import dashboard from './dashboard';
import orders from './orders';
import products from './products';
import stock from './stock';
import hotel from './hotel';
import promotions from './promotions';
import crm from './crm';
import team from './team';
import settings from './settings';
import analytics from './analytics';
import displays from './displays';
import delivery from './delivery';
import floor from './floor';
import errors from './errors';
import notify from './notify';
import landing from './landing';
import accounting from './accounting';

export const en: Dictionary = {
  common,
  ...shell,
  auth,
  modules,
  emails,
  org,
  business,
  client,
  documents,
  dashboard,
  orders,
  products,
  stock,
  hotel,
  promotions,
  crm,
  team,
  settings,
  analytics,
  displays,
  delivery,
  floor,
  errors,
  notify,
  landing,
  accounting,
};
