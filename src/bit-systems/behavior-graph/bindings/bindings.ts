import { ComponentType } from "bitecs";
import {
  EntityID,
  MediaFrame,
  MediaVideo,
  NetworkedAnimation,
  NetworkedBehavior,
  NetworkedTransform,
  PhysicsShape,
  Rigidbody,
  TextTag
} from "../../../bit-components";
import { GLTFComponentData } from "../../../utils/jsx-entity";
import { HubsWorld } from "../../../app";
import { getVideo, setVideo } from "./video";
import { getRigidBody, setRigidBody } from "./rigid-body";
import { getMediaFrame, setMediaFrame } from "./media-frame";
import { getText, setText } from "./text";

type ComponentProps = {
  [key: string]: any;
};
type GetFunctionT = (world: HubsWorld, eid: EntityID) => ComponentProps;
type SetFunctionT = (world: HubsWorld, eid: EntityID, params: ComponentProps) => void;
export type ComponentKeyType = keyof GLTFComponentData;
type ComponentBindingType = {
  [K in ComponentKeyType]?: { component: ComponentType<any>; get?: GetFunctionT; set?: SetFunctionT };
};

// This is a temporary place for all the component to get/set props methods to avoid polluting jsx-entity until we find a better home for it
// Ideally we should have a good API to add components in a self contained way. An add-ons API would be the ideal way.
export const ComponentBindings = {
  video: {
    component: MediaVideo,
    get: getVideo,
    set: setVideo
  },
  audio: {
    component: MediaVideo,
    get: getVideo,
    set: setVideo
  },
  text: {
    component: TextTag,
    get: getText,
    set: setText
  },
  mediaFrame: {
    component: MediaFrame,
    get: getMediaFrame,
    set: setMediaFrame
  },
  networkedAnimation: {
    component: NetworkedAnimation
  },
  rigidbody: {
    component: Rigidbody,
    get: getRigidBody,
    set: setRigidBody
  },
  physicsShape: {
    component: PhysicsShape
  },
  networkedTransform: {
    component: NetworkedTransform
  },
  networkedBehavior: {
    component: NetworkedBehavior
  }
} as ComponentBindingType;