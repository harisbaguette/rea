> ## Documentation Index
> Fetch the complete documentation index at: https://docs.platform.decart.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Lucy VTON 3.5

> Edit video with virtual try-on using the Lucy VTON 3.5 model.



## OpenAPI

````yaml /openapi.json post /v1/jobs/lucy-vton-3.5
openapi: 3.1.0
info:
  title: Decart API
  version: 1.0.0
servers: []
security: []
paths:
  /v1/jobs/lucy-vton-3.5:
    post:
      summary: Lucy VTON 3.5
      description: Edit video with virtual try-on using the Lucy VTON 3.5 model.
      operationId: lucy_vton_3_5_job
      parameters:
        - name: x-api-key
          in: header
          required: true
          schema:
            type: string
            description: API key for authentication
            title: X-Api-Key
          description: API key for authentication
        - name: User-Agent
          in: header
          required: false
          schema:
            anyOf:
              - type: string
              - type: 'null'
            title: User-Agent
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              $ref: >-
                #/components/schemas/Body_create_job_lucy_vton_3_5_v1_jobs_lucy_vton_3_5_post
      responses:
        '200':
          description: Successful Response
          content:
            application/json:
              schema: {}
        '422':
          description: Validation Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HTTPValidationError'
components:
  schemas:
    Body_create_job_lucy_vton_3_5_v1_jobs_lucy_vton_3_5_post:
      properties:
        data:
          type: string
          contentMediaType: application/octet-stream
          format: binary
          title: Data
          description: Video file to process
        prompt:
          type: string
          title: Prompt
          description: Text prompt. Defaults to an empty string.
          default: ''
        reference_image:
          anyOf:
            - type: string
              contentMediaType: application/octet-stream
              format: binary
            - type: 'null'
          title: Reference Image
          description: Reference image (optional)
        seed:
          type: integer
          maximum: 4294967295
          minimum: 0
          title: Seed
          description: Seed for the video generation
        resolution:
          type: string
          const: 720p
          title: Resolution
          description: Resolution of the video
          default: 720p
        enhance_prompt:
          type: boolean
          title: Enhance Prompt
          description: Whether to enhance the prompt
          default: true
      type: object
      required:
        - data
      title: Body_create_job_lucy_vton_3_5_v1_jobs_lucy_vton_3_5_post
    HTTPValidationError:
      properties:
        detail:
          items:
            $ref: '#/components/schemas/ValidationError'
          type: array
          title: Detail
      type: object
      title: HTTPValidationError
    ValidationError:
      properties:
        loc:
          items:
            anyOf:
              - type: string
              - type: integer
          type: array
          title: Location
        msg:
          type: string
          title: Message
        type:
          type: string
          title: Error Type
        input:
          title: Input
        ctx:
          type: object
          title: Context
      type: object
      required:
        - loc
        - msg
        - type
      title: ValidationError

````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.