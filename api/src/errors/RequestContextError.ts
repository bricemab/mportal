export default class RequestContextError extends Error {

  message = `RequestContext storage can only be accessed within a request context callback ! i.e. RequestContext.run(context, callback)`;

}
