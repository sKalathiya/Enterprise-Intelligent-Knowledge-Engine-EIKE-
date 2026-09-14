import { CallHandler, ExecutionContext, Injectable, NestInterceptor, RequestTimeoutException } from "@nestjs/common";
import { catchError , timeout, throwError, TimeoutError, Observable} from "rxjs";



@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest<{ originalUrl?: string; url?: string }>();
        const path = request.originalUrl ?? request.url ?? "";
        if (path.includes("/document/query")) {
            return next.handle();
        }
        return next.handle().pipe(
            timeout(15000),
            catchError(err => {
                if ( err instanceof TimeoutError ) {
                    return throwError(() => new RequestTimeoutException("The API gateway request timed out. Please try again."));
                }
                return throwError(() => err);
            })

        );
    }
}